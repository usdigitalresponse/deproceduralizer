#!/usr/bin/env python3
"""
Pattern Refinement Tool - Compare alternative regex formulations.

For each compliance issue, tests multiple pattern variants from narrow to broad,
showing what each broader variant catches that narrower ones miss.

Usage:
    python refine_patterns.py                    # Generate comparison report
    python refine_patterns.py --pattern "regex"  # Quick test single pattern
"""

import json
import logging
import re
from pathlib import Path
from dataclasses import dataclass, field
from datetime import datetime
import duckdb

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent / 'data'


# =============================================================================
# PATTERN VARIANTS - Narrow to Broad for each concept
# =============================================================================
# Each issue has multiple VARIANTS to compare. Order matters: narrow first, broad last.
# We'll show what each variant catches incrementally.

PATTERN_VARIANTS = {
    # =========================================================================
    # SIGNATURES & AUTHENTICATION
    # =========================================================================
    'wet_signature': {
        'description': 'Physical/ink signature requirements',
        'variants': [
            {'name': 'explicit_wet', 'label': 'Explicit wet/ink/handwritten',
             'patterns': [r"wet signature", r"ink signature", r"handwritten signature"]},
            {'name': 'original_signature', 'label': 'Original signature',
             'patterns': [r"original signature"]},
            {'name': 'signed_in_ink', 'label': 'Signed in ink / blue/black ink',
             'patterns': [r"signed in ink", r"blue ink", r"black ink", r"pen and ink"]},
            {'name': 'manually_signed', 'label': 'Manually/physically/personally signed',
             'patterns': [r"manually signed", r"physical signature", r"personally sign"]},
            {'name': 'notarized_signature', 'label': 'Notarized signature (implies wet)',
             'patterns': [r"notarized.{0,20}signature", r"signature.{0,20}notari"]},
            {'name': 'bear_signature', 'label': '"bear the signature"',
             'patterns': [r"bear.{0,10}signature"]},
            {'name': 'applicant_signature', 'label': 'Applicant signature (BROAD)',
             'patterns': [r"applicant.{0,10}signature", r"signature of.{0,20}applicant"]},
        ],
    },

    'notarization': {
        'description': 'Notarization requirements',
        'variants': [
            {'name': 'must_be_notarized', 'label': 'Must/shall be notarized',
             'patterns': [r"must be notarized", r"shall be notarized", r"notarization.{0,10}required"]},
            {'name': 'duly_notarized', 'label': 'Duly notarized',
             'patterns': [r"duly notarized"]},
            {'name': 'notarized', 'label': 'General "notarized"',
             'patterns': [r"\bnotarized\b"]},
            {'name': 'notary_public', 'label': 'Notary public',
             'patterns': [r"notary public"]},
            {'name': 'sworn_before', 'label': 'Sworn/acknowledged before',
             'patterns': [r"sworn.{0,20}before", r"acknowledged before", r"subscribed.{0,20}before"]},
            {'name': 'notary_seal', 'label': 'Notary seal',
             'patterns': [r"notary.{0,10}seal"]},
            {'name': 'jurat', 'label': 'Jurat (legal term)',
             'patterns': [r"\bjurat\b"]},
        ],
    },

    'witness': {
        'description': 'Witness signature requirements',
        'variants': [
            {'name': 'two_witnesses', 'label': 'Two witnesses (specific count)',
             'patterns': [r"two witnesses", r"2 witnesses"]},
            {'name': 'witness_signature', 'label': 'Witness signature / witnessed by',
             'patterns': [r"witness.{0,5}signature", r"witnessed by"]},
            {'name': 'attested', 'label': 'Attested / attestation',
             'patterns': [r"\battested\b", r"attestation"]},
            {'name': 'presence_of', 'label': 'In the presence of',
             'patterns': [r"in the presence of"]},
            {'name': 'general_witness', 'label': 'General "witness" (VERY BROAD)',
             'patterns': [r"\bwitness\b"]},
        ],
    },

    'embossed_seal': {
        'description': 'Embossed/official seal requirements',
        'variants': [
            {'name': 'embossed_seal', 'label': 'Embossed/raised/impressed seal',
             'patterns': [r"embossed seal", r"raised seal", r"impressed seal"]},
            {'name': 'corporate_seal', 'label': 'Corporate seal',
             'patterns': [r"corporate seal"]},
            {'name': 'official_seal', 'label': 'Official seal (BROADER)',
             'patterns': [r"official seal"]},
            {'name': 'seal_affixed', 'label': 'Seal affixed',
             'patterns': [r"seal.{0,5}affixed"]},
        ],
    },

    'original_document': {
        'description': 'Original document requirements (no copies)',
        'variants': [
            {'name': 'no_photocopies', 'label': 'No photocopies / original only',
             'patterns': [r"no photocopies", r"original only", r"originals only"]},
            {'name': 'submit_original', 'label': 'Submit/provide the original',
             'patterns': [r"submit.{0,10}original", r"provide.{0,10}original"]},
            {'name': 'original_document', 'label': 'Original document',
             'patterns': [r"original document"]},
            {'name': 'original_certificate', 'label': 'Original certificate/letter',
             'patterns': [r"original certificate", r"original letter"]},
            {'name': 'must_be_original', 'label': 'Must/shall be original',
             'patterns': [r"must be.{0,5}original", r"shall be.{0,5}original"]},
        ],
    },

    # =========================================================================
    # MAIL & COMMUNICATION
    # =========================================================================
    'mail_only': {
        'description': 'Mail as required submission method',
        'variants': [
            {'name': 'explicit_mail_only', 'label': 'Mail only / must be mailed',
             'patterns': [r"mail.{0,5}only", r"must be mailed", r"shall be mailed"]},
            {'name': 'submit_by_mail', 'label': 'Submit/send by mail',
             'patterns': [r"submit.{0,20}by mail", r"send by mail"]},
            {'name': 'us_mail', 'label': 'U.S. Mail / USPS',
             'patterns': [r"u\.?s\.?\s*mail", r"\busps\b", r"united states.{0,10}mail"]},
            {'name': 'postal_service', 'label': 'Postal service / first class',
             'patterns': [r"postal.{0,10}service", r"first.{0,10}class.{0,10}mail"]},
            {'name': 'general_by_mail', 'label': 'General "by mail" (BROAD)',
             'patterns': [r"\bby mail\b"]},
            {'name': 'mailed_to', 'label': '"mailed to" (BROAD)',
             'patterns': [r"mailed to"]},
            {'name': 'mailing_address', 'label': 'Mailing address (VERY BROAD)',
             'patterns': [r"mailing address"]},
        ],
    },

    'certified_mail': {
        'description': 'Certified/registered mail requirements',
        'variants': [
            {'name': 'certified_mail_exact', 'label': 'Certified mail / registered mail',
             'patterns': [r"certified mail", r"registered mail"]},
            {'name': 'return_receipt', 'label': 'Return receipt',
             'patterns': [r"return receipt", r"delivery confirmation"]},
            {'name': 'proof_of_mailing', 'label': 'Proof/certificate of mailing',
             'patterns': [r"proof of mailing", r"certificate of mailing"]},
            {'name': 'by_certified', 'label': 'By/via certified',
             'patterns': [r"by certified", r"via certified", r"send.{0,20}certified"]},
            {'name': 'postmarked', 'label': 'Postmarked by',
             'patterns': [r"postmarked by", r"postmark.{0,20}deadline"]},
        ],
    },

    'fax': {
        'description': 'Fax requirements',
        'variants': [
            {'name': 'fax_required', 'label': 'Submit by fax / fax only',
             'patterns': [r"submit.{0,20}by fax", r"fax.{0,5}only", r"must.{0,10}fax", r"shall.{0,10}fax"]},
            {'name': 'via_fax', 'label': 'Via fax / by facsimile',
             'patterns': [r"via.{0,5}fax", r"by.{0,5}facsimile", r"fax.{0,5}to\b"]},
            {'name': 'fax_number', 'label': 'Fax number (contact info)',
             'patterns': [r"fax.{0,5}number", r"fax.{0,3}:", r"facsimile.{0,10}number"]},
            {'name': 'general_fax', 'label': 'General "fax" (VERY BROAD)',
             'patterns': [r"\bfax\b"]},
        ],
    },

    'landline': {
        'description': 'Landline/telephone requirements',
        'variants': [
            {'name': 'landline_explicit', 'label': 'Landline / touch-tone',
             'patterns': [r"\blandline\b", r"touch-tone", r"touchtone"]},
            {'name': 'by_telephone', 'label': 'By telephone / telephone call',
             'patterns': [r"by telephone", r"telephone call", r"via telephone"]},
            {'name': 'call_the_office', 'label': 'Call the office',
             'patterns': [r"call the office", r"call.{0,20}office", r"telephone.{0,20}office"]},
            {'name': 'verbal_authorization', 'label': 'Verbal/oral authorization',
             'patterns': [r"verbal authorization", r"oral authorization", r"by phone"]},
        ],
    },

    # =========================================================================
    # PHYSICAL PRESENCE
    # =========================================================================
    'in_person_submission': {
        'description': 'In-person submission requirements',
        'variants': [
            {'name': 'appear_in_person', 'label': 'Appear in person / personal appearance',
             'patterns': [r"appear in person", r"personal appearance"]},
            {'name': 'submit_in_person', 'label': 'Submit in person',
             'patterns': [r"submit.{0,10}in person", r"in.{0,3}person.{0,10}submission"]},
            {'name': 'hand_deliver', 'label': 'Hand deliver',
             'patterns': [r"hand.{0,3}deliver"]},
            {'name': 'must_appear', 'label': 'Must/shall appear (BROAD)',
             'patterns': [r"must.{0,5}appear\b", r"shall.{0,5}appear\b", r"required to appear"]},
        ],
    },

    'in_person_hearing': {
        'description': 'In-person hearing/meeting requirements',
        'variants': [
            {'name': 'in_person_hearing', 'label': 'In-person hearing',
             'patterns': [r"in.{0,3}person.{0,10}hearing", r"appear at.{0,20}hearing"]},
            {'name': 'physical_attendance', 'label': 'Physical attendance',
             'patterns': [r"physical.{0,5}attendance", r"attend in person"]},
            {'name': 'appear_before_board', 'label': 'Appear before board/commission',
             'patterns': [r"appear before.{0,20}board", r"appear before.{0,20}commission"]},
        ],
    },

    'in_person_pickup': {
        'description': 'In-person pickup requirements',
        'variants': [
            {'name': 'pick_up_in_person', 'label': 'Pick up in person',
             'patterns': [r"pick up in person", r"picked up in person"]},
            {'name': 'collect_in_person', 'label': 'Collect/retrieve in person',
             'patterns': [r"collect in person", r"retrieve in person", r"claim in person"]},
            {'name': 'available_for_pickup', 'label': 'Available for pickup',
             'patterns': [r"available for pickup", r"available.{0,10}pick.{0,3}up"]},
        ],
    },

    'physical_forms': {
        'description': 'Physical form retrieval requirements',
        'variants': [
            {'name': 'forms_available_at', 'label': 'Forms available at [location]',
             'patterns': [r"forms available at", r"forms.{0,10}available.{0,10}at"]},
            {'name': 'obtain_forms_from', 'label': 'Obtain forms from',
             'patterns': [r"obtain forms from", r"forms may be obtained"]},
            {'name': 'pick_up_application', 'label': 'Pick up application',
             'patterns': [r"pick up.{0,10}application", r"application.{0,10}pick.{0,3}up"]},
        ],
    },

    'physical_inspection': {
        'description': 'Physical inspection location requirements',
        'variants': [
            {'name': 'public_inspection', 'label': 'Available for public inspection',
             'patterns': [r"available for public inspection", r"public inspection"]},
            {'name': 'open_to_inspection', 'label': 'Open to inspection',
             'patterns': [r"open to inspection", r"maintain for inspection"]},
            {'name': 'available_for_review', 'label': 'Available for review at',
             'patterns': [r"available for review at", r"inspect at the office"]},
            {'name': 'examine_during_hours', 'label': 'Examine during business hours',
             'patterns': [r"examine during.{0,20}hours", r"during business hours"]},
        ],
    },

    'physical_posting': {
        'description': 'Physical posting/display requirements',
        'variants': [
            {'name': 'conspicuously_posted', 'label': 'Conspicuously posted',
             'patterns': [r"conspicuously posted", r"conspicuously displayed"]},
            {'name': 'prominently_displayed', 'label': 'Prominently displayed',
             'patterns': [r"prominently displayed", r"prominently posted"]},
            {'name': 'posted_on_premises', 'label': 'Posted on premises',
             'patterns': [r"posted on the premises", r"posted at all times"]},
            {'name': 'post_a_notice', 'label': 'Post a notice / display a sign',
             'patterns': [r"post a notice", r"display.{0,10}sign"]},
            {'name': 'visible_to_public', 'label': 'Visible to the public',
             'patterns': [r"visible to the public", r"public.{0,10}view"]},
        ],
    },

    'bulletin_board': {
        'description': 'Bulletin board requirements',
        'variants': [
            {'name': 'bulletin_board', 'label': 'Bulletin board',
             'patterns': [r"bulletin board"]},
            {'name': 'notice_board', 'label': 'Notice board / community board',
             'patterns': [r"notice board", r"community board", r"public board"]},
            {'name': 'posted_on_board', 'label': 'Posted on the board',
             'patterns': [r"posted on the board", r"posted.{0,10}board"]},
        ],
    },

    # =========================================================================
    # PAYMENT METHODS
    # =========================================================================
    'check_payment': {
        'description': 'Check/money order payment requirements',
        'variants': [
            {'name': 'money_order', 'label': 'Money order',
             'patterns': [r"money order"]},
            {'name': 'certified_check', 'label': 'Certified/cashier\'s check',
             'patterns': [r"certified check", r"cashier.{0,3}s? check"]},
            {'name': 'check_or_money_order', 'label': 'Check or money order',
             'patterns': [r"check or money order", r"check.{0,5}money order"]},
            {'name': 'payable_to', 'label': 'Payable to',
             'patterns': [r"payable to"]},
            {'name': 'personal_check', 'label': 'Personal check',
             'patterns': [r"personal check"]},
        ],
    },

    'cash_only': {
        'description': 'Cash-only payment requirements',
        'variants': [
            {'name': 'cash_only', 'label': 'Cash only',
             'patterns': [r"cash only", r"cash.{0,5}only"]},
            {'name': 'exact_change', 'label': 'Exact change',
             'patterns': [r"exact change", r"no change provided"]},
            {'name': 'cash_payment', 'label': 'Cash payment / currency',
             'patterns': [r"cash payment", r"\bcurrency\b", r"exact amount"]},
        ],
    },

    'no_credit_cards': {
        'description': 'No credit card payment',
        'variants': [
            {'name': 'no_credit_cards', 'label': 'No credit cards',
             'patterns': [r"no credit cards?", r"credit cards? not accepted"]},
            {'name': 'cash_or_check_only', 'label': 'Cash or check only',
             'patterns': [r"cash or check only", r"no electronic payment"]},
            {'name': 'no_card_payments', 'label': 'No card payments',
             'patterns': [r"no card payments?", r"do not accept credit"]},
        ],
    },

    'in_person_payment': {
        'description': 'In-person payment requirements',
        'variants': [
            {'name': 'pay_in_person', 'label': 'Pay in person',
             'patterns': [r"pay in person", r"payment in person"]},
            {'name': 'payment_at_office', 'label': 'Payment at the office',
             'patterns': [r"payment at the office", r"pay at the counter", r"pay at the window"]},
            {'name': 'remit_in_person', 'label': 'Remit in person',
             'patterns': [r"remit in person", r"in.{0,3}person.{0,10}payment"]},
        ],
    },

    # =========================================================================
    # OBSOLETE TECHNOLOGY
    # =========================================================================
    'obsolete_comm': {
        'description': 'Obsolete communication technology',
        'variants': [
            {'name': 'telegram', 'label': 'Telegram / telegraph',
             'patterns': [r"\btelegram\b", r"\btelegraph\b"]},
            {'name': 'telex', 'label': 'Telex',
             'patterns': [r"\btelex\b"]},
            {'name': 'pager', 'label': 'Pager / beeper',
             'patterns': [r"\bpager\b", r"\bbeeper\b", r"paging.{0,10}device"]},
            {'name': 'wire_cable', 'label': 'By wire / by cable (BROAD)',
             'patterns': [r"\bby wire\b", r"\bby cable\b", r"cablegram"]},
        ],
    },

    'obsolete_media': {
        'description': 'Obsolete storage media',
        'variants': [
            {'name': 'floppy_disk', 'label': 'Floppy disk / diskette',
             'patterns': [r"floppy.{0,5}disk", r"\bdiskette\b"]},
            {'name': 'cd_dvd', 'label': 'CD-ROM / DVD',
             'patterns': [r"cd-rom", r"\bdvd\b", r"compact disc"]},
            {'name': 'magnetic_tape', 'label': 'Magnetic tape',
             'patterns': [r"magnetic.{0,5}tape"]},
            {'name': 'usb_flash', 'label': 'USB/flash drive',
             'patterns': [r"usb drive", r"flash drive", r"thumb drive"]},
        ],
    },

    'microfiche': {
        'description': 'Microfiche/microfilm requirements',
        'variants': [
            {'name': 'microfiche', 'label': 'Microfiche',
             'patterns': [r"microfiche"]},
            {'name': 'microfilm', 'label': 'Microfilm / microform',
             'patterns': [r"microfilm", r"microform", r"microcard"]},
            {'name': 'aperture_card', 'label': 'Aperture card',
             'patterns': [r"aperture card"]},
        ],
    },

    'obsolete_software': {
        'description': 'Obsolete software/format references',
        'variants': [
            {'name': 'wordperfect', 'label': 'WordPerfect',
             'patterns': [r"wordperfect"]},
            {'name': 'lotus', 'label': 'Lotus 123',
             'patterns': [r"\blotus\b", r"lotus.{0,5}123"]},
            {'name': 'dos_dbase', 'label': 'DOS / dBASE',
             'patterns': [r"\bdos\b", r"\bdbase\b"]},
            {'name': 'ascii_format', 'label': 'ASCII format',
             'patterns': [r"ascii.{0,10}format", r"ascii.{0,10}text"]},
        ],
    },

    'typewriter': {
        'description': 'Typewriter requirements',
        'variants': [
            {'name': 'typewriter', 'label': 'Typewriter (explicit)',
             'patterns': [r"\btypewriter\b"]},
            {'name': 'typewritten', 'label': 'Typewritten',
             'patterns': [r"typewritten", r"type.{0,3}written"]},
            {'name': 'must_be_typed', 'label': 'Must/shall be typed',
             'patterns': [r"must be typed", r"shall be typed"]},
            {'name': 'typed_copy', 'label': 'Typed copy',
             'patterns': [r"typed.{0,5}copy"]},
        ],
    },

    'pdf_only': {
        'description': 'PDF-only format requirements',
        'variants': [
            {'name': 'pdf_only', 'label': 'PDF only',
             'patterns': [r"pdf only", r"pdf.{0,5}only"]},
            {'name': 'pdf_format', 'label': 'PDF format / submit as PDF',
             'patterns': [r"pdf format", r"submit as pdf", r"in pdf"]},
            {'name': 'adobe_pdf', 'label': 'Adobe PDF / .pdf',
             'patterns': [r"adobe pdf", r"\.pdf\b"]},
        ],
    },

    # =========================================================================
    # DOCUMENT FORMAT
    # =========================================================================
    'multiple_copies': {
        'description': 'Multiple copy submission requirements',
        'variants': [
            {'name': 'in_triplicate', 'label': 'In duplicate/triplicate',
             'patterns': [r"\bin duplicate\b", r"\bin triplicate\b"]},
            {'name': 'n_copies', 'label': 'Three/four/five copies',
             'patterns': [r"three copies", r"four copies", r"five copies", r"\d+ copies"]},
            {'name': 'submit_copies', 'label': 'Submit X copies',
             'patterns': [r"submit.{0,10}\d+.{0,10}copies"]},
            {'name': 'original_and_copies', 'label': 'Original and X copies',
             'patterns': [r"original and.{0,10}\d+.{0,10}cop"]},
            {'name': 'multiple_copies', 'label': 'Multiple copies',
             'patterns': [r"multiple copies"]},
        ],
    },

    'carbon_copy': {
        'description': 'Carbon copy requirements',
        'variants': [
            {'name': 'carbon_copy', 'label': 'Carbon copy',
             'patterns': [r"carbon copy", r"carbon.{0,5}copies"]},
            {'name': 'cc', 'label': 'CC:',
             'patterns': [r"\bcc:\b"]},
            {'name': 'duplicate_copy', 'label': 'Duplicate copy',
             'patterns': [r"duplicate copy", r"duplicate copies"]},
        ],
    },

    'binding_required': {
        'description': 'Document binding requirements',
        'variants': [
            {'name': 'spiral_bound', 'label': 'Spiral bound / three-ring',
             'patterns': [r"spiral bound", r"three-ring binder", r"three ring"]},
            {'name': 'bound_volume', 'label': 'Bound volume',
             'patterns': [r"bound volume", r"\bbound\b"]},
            {'name': 'stapled', 'label': 'Stapled / fastened',
             'patterns': [r"\bstapled\b", r"fastened", r"\bclipped\b"]},
        ],
    },

    'paper_specs': {
        'description': 'Paper specification requirements',
        'variants': [
            {'name': 'letter_size', 'label': '8.5x11 / letter size',
             'patterns': [r"8\.?5.{0,5}x.{0,5}11", r"letter size"]},
            {'name': 'legal_size', 'label': '8.5x14 / legal size',
             'patterns': [r"8\.?5.{0,5}x.{0,5}14", r"legal size"]},
            {'name': 'bond_paper', 'label': 'Bond paper / paper stock',
             'patterns': [r"bond paper", r"20 lb", r"paper stock"]},
            {'name': 'white_paper', 'label': 'White paper / colored paper',
             'patterns': [r"white paper", r"colored paper"]},
        ],
    },

    'photo_specs': {
        'description': 'Photo specification requirements',
        'variants': [
            {'name': 'passport_photo', 'label': 'Passport photo / 2x2',
             'patterns': [r"passport photo", r"2.{0,3}x.{0,3}2"]},
            {'name': 'photograph_size', 'label': 'Photograph size/dimensions',
             'patterns': [r"photograph size", r"photo dimensions"]},
            {'name': 'recent_photograph', 'label': 'Recent photograph',
             'patterns': [r"recent photograph", r"current photograph"]},
            {'name': 'headshot', 'label': 'Headshot / photo attached',
             'patterns': [r"\bheadshot\b", r"photo attached"]},
        ],
    },

    'letterhead': {
        'description': 'Letterhead requirements',
        'variants': [
            {'name': 'on_letterhead', 'label': 'On letterhead',
             'patterns': [r"on letterhead", r"official letterhead"]},
            {'name': 'company_letterhead', 'label': 'Company/agency letterhead',
             'patterns': [r"company letterhead", r"agency letterhead"]},
            {'name': 'printed_letterhead', 'label': 'Printed letterhead',
             'patterns': [r"printed letterhead"]},
        ],
    },

    'handwriting_specs': {
        'description': 'Handwriting specification requirements',
        'variants': [
            {'name': 'block_letters', 'label': 'Block letters / print clearly',
             'patterns': [r"block letters", r"print clearly"]},
            {'name': 'legible_handwriting', 'label': 'Legible handwriting',
             'patterns': [r"legible handwriting", r"neat handwriting"]},
            {'name': 'print_in_ink', 'label': 'Print in ink / hand-printed',
             'patterns': [r"print in ink", r"hand-printed", r"hand printed"]},
        ],
    },

    # =========================================================================
    # PROCESS & TRACKING
    # =========================================================================
    'physical_log': {
        'description': 'Physical log/sign-in requirements',
        'variants': [
            {'name': 'sign_in_sheet', 'label': 'Sign-in sheet',
             'patterns': [r"sign-in sheet", r"sign in sheet", r"signin sheet"]},
            {'name': 'log_book', 'label': 'Log book / visitor log',
             'patterns': [r"log book", r"visitor log", r"logbook"]},
            {'name': 'sign_the_register', 'label': 'Sign the register',
             'patterns': [r"sign the register", r"entry log"]},
            {'name': 'written_log', 'label': 'Written log / daily log',
             'patterns': [r"written log", r"daily log"]},
        ],
    },

    'routing_slip': {
        'description': 'Routing/transmittal slip requirements',
        'variants': [
            {'name': 'routing_slip', 'label': 'Routing slip',
             'patterns': [r"routing slip"]},
            {'name': 'transmittal_form', 'label': 'Transmittal form',
             'patterns': [r"transmittal form", r"transmittal sheet"]},
            {'name': 'tracking_sheet', 'label': 'Tracking sheet / circulation slip',
             'patterns': [r"tracking sheet", r"circulation slip"]},
        ],
    },

    'storage_location': {
        'description': 'Specific storage location requirements',
        'variants': [
            {'name': 'stored_at', 'label': 'Stored at / maintained at',
             'patterns': [r"stored at", r"maintained at"]},
            {'name': 'kept_at_premises', 'label': 'Kept at the premises',
             'patterns': [r"kept at the premises", r"kept on.{0,10}premises"]},
            {'name': 'on_site_storage', 'label': 'On-site storage / at the facility',
             'patterns': [r"on.{0,3}site.{0,10}storage", r"at the facility"]},
            {'name': 'records_location', 'label': 'Records location',
             'patterns': [r"records location", r"records.{0,10}kept"]},
        ],
    },

    'fixed_window': {
        'description': 'Fixed processing window requirements',
        'variants': [
            {'name': 'filing_period', 'label': 'Filing period / application window',
             'patterns': [r"filing period", r"application window"]},
            {'name': 'applications_accepted', 'label': 'Applications accepted [dates]',
             'patterns': [r"applications accepted", r"accepted between"]},
            {'name': 'open_enrollment', 'label': 'Open enrollment / submission period',
             'patterns': [r"open enrollment", r"submission period"]},
            {'name': 'only_during', 'label': 'Only during [period]',
             'patterns': [r"only during"]},
        ],
    },

    'waiting_period': {
        'description': 'Mandatory waiting period requirements',
        'variants': [
            {'name': 'waiting_period', 'label': 'Waiting period',
             'patterns': [r"waiting period"]},
            {'name': 'must_wait', 'label': 'Must wait / cooling off',
             'patterns': [r"must wait", r"cooling off", r"cooling.{0,3}off"]},
            {'name': 'no_sooner_than', 'label': 'No sooner than',
             'patterns': [r"no sooner than", r"not sooner than"]},
            {'name': 'minimum_days_before', 'label': 'Minimum X days before',
             'patterns': [r"minimum of.{0,10}days before", r"at least.{0,10}days before"]},
        ],
    },

    # =========================================================================
    # PUBLICATION & REPORTING
    # =========================================================================
    'newspaper': {
        'description': 'Newspaper publication requirements',
        'variants': [
            {'name': 'newspaper_circulation', 'label': 'Newspaper of general circulation',
             'patterns': [r"newspaper of general circulation"]},
            {'name': 'publish_newspaper', 'label': 'Publish in newspaper',
             'patterns': [r"publish.{0,20}newspaper", r"published.{0,20}newspaper"]},
            {'name': 'newspaper_notice', 'label': 'Newspaper notice/publication',
             'patterns': [r"newspaper.{0,10}notice", r"newspaper.{0,10}publication"]},
            {'name': 'legal_notice', 'label': 'Legal notice (BROAD)',
             'patterns': [r"legal.{0,5}notice"]},
            {'name': 'local_newspaper', 'label': 'Local/official newspaper',
             'patterns': [r"local newspaper", r"official newspaper"]},
        ],
    },

    'mandated_reports': {
        'description': 'Mandated reporting requirements',
        'variants': [
            {'name': 'annual_quarterly_report', 'label': 'Annual/quarterly report',
             'patterns': [r"annual report", r"quarterly report"]},
            {'name': 'submit_file_report', 'label': 'Submit/file a report',
             'patterns': [r"submit a report", r"file a report"]},
            {'name': 'reporting_requirements', 'label': 'Reporting requirements',
             'patterns': [r"reporting requirements", r"report to the"]},
            {'name': 'statistical_report', 'label': 'Statistical report',
             'patterns': [r"statistical report", r"publish a report"]},
        ],
    },
}


@dataclass
class VariantResult:
    """Results for a pattern variant."""
    name: str
    label: str
    patterns: list[str]
    nj_count: int
    ny_count: int
    total: int
    nj_ids: set = field(default_factory=set)
    ny_ids: set = field(default_factory=set)
    incremental_nj: int = 0
    incremental_ny: int = 0
    incremental_total: int = 0
    incremental_samples: list = field(default_factory=list)


def load_data() -> tuple[duckdb.DuckDBPyConnection, dict, dict]:
    """Load regulation data into DuckDB."""
    conn = duckdb.connect(':memory:')
    # NOTE: Local DuckDB analysis table intentionally uses 'state' column —
    # this is isolated from the production DB schema (which uses 'jurisdiction').
    conn.execute("""
        CREATE TABLE docs (
            state VARCHAR, idx INTEGER, title TEXT, citation TEXT, content TEXT
        )
    """)

    print("Loading NJ data...", end=" ", flush=True)
    nj_path = DATA_DIR / 'nj_regulations_complete.json'
    with open(nj_path) as f:
        nj_data = json.load(f)
    nj_rows = [('nj', i, doc.get('title', ''), doc.get('njac_citation', ''), doc.get('content', '') or '')
               for i, doc in enumerate(nj_data)]
    conn.executemany("INSERT INTO docs VALUES (?, ?, ?, ?, ?)", nj_rows)
    print(f"{len(nj_data):,} docs")

    print("Loading NY data...", end=" ", flush=True)
    ny_path = DATA_DIR / 'ny_regulations_complete.json'
    with open(ny_path) as f:
        ny_data = json.load(f)
    ny_rows = [('ny', i, doc.get('title', ''), doc.get('nycrr_citation', ''), doc.get('content', '') or '')
               for i, doc in enumerate(ny_data)]
    conn.executemany("INSERT INTO docs VALUES (?, ?, ?, ?, ?)", ny_rows)
    print(f"{len(ny_data):,} docs")

    return conn, {i: doc for i, doc in enumerate(nj_data)}, {i: doc for i, doc in enumerate(ny_data)}


def test_patterns(conn, patterns: list[str]) -> tuple[set, set]:
    """Test patterns and return matching doc IDs."""
    all_nj, all_ny = set(), set()
    for pattern in patterns:
        escaped = pattern.replace("'", "''")
        try:
            nj_rows = conn.execute(f"SELECT idx FROM docs WHERE state = 'nj' AND regexp_matches(lower(content), '{escaped}')").fetchall()
            all_nj.update(row[0] for row in nj_rows)
            ny_rows = conn.execute(f"SELECT idx FROM docs WHERE state = 'ny' AND regexp_matches(lower(content), '{escaped}')").fetchall()
            all_ny.update(row[0] for row in ny_rows)
        except Exception as e:
            print(f"    Error: {pattern}: {e}")
    return all_nj, all_ny


def get_sample(doc: dict, patterns: list[str], state: str) -> dict | None:
    """Get a sample match from a document."""
    content = doc.get('content', '') or ''
    if not content:
        return None
    for pattern in patterns:
        try:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                start, end = max(0, match.start() - 80), min(len(content), match.end() + 80)
                return {
                    'state': state.upper(),
                    'title': (doc.get('title', '') or 'No title')[:60],
                    'match': match.group(),
                    'context': content[start:end].replace('\n', ' ').strip(),
                }
        except (re.error, TypeError) as e:
            logger.warning(f"Pattern match failed for pattern '{pattern}' in state {state}: {type(e).__name__}: {e}")
    return None


def analyze_issue(conn, nj_lookup, ny_lookup, issue_type: str, config: dict) -> list[VariantResult]:
    """Analyze all variants for an issue type."""
    results = []
    cumulative_nj, cumulative_ny = set(), set()

    for variant in config['variants']:
        nj_ids, ny_ids = test_patterns(conn, variant['patterns'])
        new_nj, new_ny = nj_ids - cumulative_nj, ny_ids - cumulative_ny

        result = VariantResult(
            name=variant['name'], label=variant['label'], patterns=variant['patterns'],
            nj_count=len(nj_ids), ny_count=len(ny_ids), total=len(nj_ids) + len(ny_ids),
            nj_ids=nj_ids, ny_ids=ny_ids,
            incremental_nj=len(new_nj), incremental_ny=len(new_ny), incremental_total=len(new_nj) + len(new_ny),
        )

        # Get samples
        samples = []
        for idx in list(new_nj)[:2]:
            s = get_sample(nj_lookup.get(idx, {}), variant['patterns'], 'nj')
            if s: samples.append(s)
        for idx in list(new_ny)[:max(0, 2 - len(samples))]:
            s = get_sample(ny_lookup.get(idx, {}), variant['patterns'], 'ny')
            if s: samples.append(s)
        result.incremental_samples = samples
        results.append(result)

        cumulative_nj.update(nj_ids)
        cumulative_ny.update(ny_ids)

    return results


def generate_report(all_results: dict, output_path: Path):
    """Generate markdown report - easy to scan and decide."""
    lines = [
        "# Pattern Variant Comparison",
        "",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## How to Read This Report",
        "",
        "For each issue type, variants are listed from **narrow (precise) to broad (noisy)**.",
        "",
        "- **Total**: documents matching this variant",
        "- **+New**: documents this variant catches that PREVIOUS variants don't",
        "- **RECOMMENDATION**: Include variants until +New samples look like junk",
        "",
        "Each variant shows 1-2 sample matches so you can judge quality.",
        "",
        "---",
        "",
        "## Quick Summary",
        "",
        "| Issue Type | Total Docs | Variants |",
        "|------------|------------|----------|",
    ]

    for issue_type, results in all_results.items():
        all_nj = set()
        all_ny = set()
        for r in results:
            all_nj.update(r.nj_ids)
            all_ny.update(r.ny_ids)
        total = len(all_nj) + len(all_ny)
        lines.append(f"| [{issue_type}](#{issue_type}) | {total:,} | {len(results)} |")

    lines.append("")

    # Detail for each issue
    for issue_type, results in all_results.items():
        config = PATTERN_VARIANTS[issue_type]
        all_nj = set()
        all_ny = set()
        for r in results:
            all_nj.update(r.nj_ids)
            all_ny.update(r.ny_ids)

        lines.extend([
            "---",
            "",
            f"## {issue_type}",
            "",
            f"_{config['description']}_ | **{len(all_nj) + len(all_ny):,} total docs** (NJ: {len(all_nj):,}, NY: {len(all_ny):,})",
            "",
        ])

        # Compact table
        for r in results:
            # Determine recommendation emoji
            if r.incremental_total == 0:
                emoji = "⚪"  # No new matches
            elif "BROAD" in r.label or "VERY BROAD" in r.label:
                emoji = "⚠️"  # Broad - review carefully
            else:
                emoji = "✅"  # Looks good

            patterns_short = ", ".join(f"`{p}`" for p in r.patterns[:2])
            if len(r.patterns) > 2:
                patterns_short += f" (+{len(r.patterns)-2})"

            lines.append(f"### {emoji} {r.label}")
            lines.append(f"**Patterns:** {patterns_short}")
            lines.append(f"**Matches:** {r.total:,} total | **+{r.incremental_total:,} new**")
            lines.append("")

            # Show samples inline
            if r.incremental_samples:
                for s in r.incremental_samples[:2]:
                    lines.append(f"> **[{s['state']}]** {s['title']}")
                    lines.append(f"> Match: `{s['match']}`")
                    lines.append(f"> _{s['context'][:150]}..._")
                    lines.append(">")
            elif r.incremental_total > 0:
                lines.append("> *(no samples retrieved)*")
                lines.append(">")

            lines.append("")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text('\n'.join(lines))
    print(f"\nReport written to: {output_path}")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', '-o', default='data/outputs/pattern_variants.md')
    parser.add_argument('--pattern', '-p', help='Quick test single pattern')
    args = parser.parse_args()

    conn, nj_lookup, ny_lookup = load_data()

    if args.pattern:
        nj_ids, ny_ids = test_patterns(conn, [args.pattern])
        print(f"\nPattern: {args.pattern}")
        print(f"NJ: {len(nj_ids):,}, NY: {len(ny_ids):,}, Total: {len(nj_ids) + len(ny_ids):,}")
        for idx in list(nj_ids)[:3]:
            s = get_sample(nj_lookup.get(idx, {}), [args.pattern], 'nj')
            if s:
                print(f"  [{s['state']}] {s['title']}: '{s['match']}'")
        conn.close()
        return

    print(f"\nAnalyzing {len(PATTERN_VARIANTS)} issue types...")
    all_results = {}
    for issue_type, config in PATTERN_VARIANTS.items():
        print(f"  {issue_type}...", end=" ", flush=True)
        results = analyze_issue(conn, nj_lookup, ny_lookup, issue_type, config)
        all_results[issue_type] = results
        total = sum(len(r.nj_ids | r.ny_ids) for r in results) if results else 0
        print(f"{len(results)} variants")

    conn.close()
    generate_report(all_results, Path(__file__).parent.parent.parent / args.output)
    print("\nDone! Open the report to review patterns.")


if __name__ == "__main__":
    main()
