"""
Mapping from natural-language law names (as found in NY regulation text)
to OpenLegislation law IDs.

Auto-generated from the NY Senate OpenLegislation API law list,
with manual variants added for names that appear differently in regulation text.

Usage:
    from lib.ny_law_names import resolve_law_id

    law_id = resolve_law_id("Social Services")  # -> "SOS"
    law_id = resolve_law_id("Vehicle and Traffic")  # -> "VAT"
"""

# Canonical mapping: API law name -> law ID
# Source: OpenLegislation /api/3/laws (CONSOLIDATED type only)
_CANONICAL = {
    "Abandoned Property": "ABP",
    "Alcoholic Beverage Control": "ABC",
    "Agriculture & Markets": "AGM",
    "Alternative County Government": "ACG",
    "Arts and Cultural Affairs": "ACA",
    "Banking": "BNK",
    "Benevolent Orders": "BVO",
    "Business Corporation": "BSC",
    "Canal": "CAL",
    "Cannabis": "CAN",
    "Civil Practice Law & Rules": "CVP",
    "Civil Rights": "CVR",
    "Civil Service": "CVS",
    "Cooperative Corporations": "CCO",
    "Correction": "COR",
    "County": "CNT",
    "Criminal Procedure": "CPL",
    "Debtor & Creditor": "DCD",
    "Domestic Relations": "DOM",
    "Economic Development Law": "COM",
    "Education": "EDN",
    "Elder": "ELD",
    "Election": "ELN",
    "Eminent Domain Procedure": "EDP",
    "Employers' Liability": "EML",
    "Energy": "ENG",
    "Environmental Conservation": "ENV",
    "Estates, Powers & Trusts": "EPT",
    "Executive": "EXC",
    "Financial Services Law": "FIS",
    "General Associations": "GAS",
    "General Business": "GBS",
    "General City": "GCT",
    "General Construction": "GCN",
    "General Municipal": "GMU",
    "General Obligations": "GOB",
    "Highway": "HAY",
    "Indian": "IND",
    "Insurance": "ISC",
    "Judiciary": "JUD",
    "Labor": "LAB",
    "Legislative": "LEG",
    "Lien": "LIE",
    "Limited Liability Company Law": "LLC",
    "Local Finance": "LFN",
    "Mental Hygiene": "MHY",
    "Military": "MIL",
    "Multiple Dwelling": "MDW",
    "Multiple Residence": "MRE",
    "Municipal Home Rule": "MHR",
    "Municipal Housing Authorities": "MHA",
    "Navigation": "NAV",
    "New York State Printing and Public Documents": "PPD",
    "Not-for-Profit Corporation": "NPC",
    "Parks, Recreation and Historic Preservation": "PAR",
    "Partnership": "PTR",
    "Penal": "PEN",
    "Personal Property": "PEP",
    "Private Housing Finance": "PVH",
    "Public Authorities": "PBA",
    "Public Buildings": "PBB",
    "Public Health": "PBH",
    "Public Housing": "PBG",
    "Public Lands": "PBL",
    "Public Officers": "PBO",
    "Public Service": "PBS",
    "Racing, Pari-Mutuel Wagering and Breeding Law": "PML",
    "Railroad": "RRD",
    "Rapid Transit": "RAT",
    "Real Property": "RPP",
    "Real Property Actions & Proceedings": "RPA",
    "Real Property Tax": "RPT",
    "Religious Corporations": "RCO",
    "Retirement & Social Security": "RSS",
    "Rural Electric Cooperative": "REL",
    "Second Class Cities": "SCC",
    "Social Services": "SOS",
    "Soil & Water Conservation Districts": "SWC",
    "State": "STL",
    "State Administrative Procedure Act": "SAP",
    "State Finance": "STF",
    "State Technology": "STT",
    "Statute of Local Governments": "SLG",
    "Tax": "TAX",
    "Town": "TWN",
    "Transportation": "TRA",
    "Transportation Corporations": "TCP",
    "Uniform Commercial Code": "UCC",
    "Vehicle & Traffic": "VAT",
    "Veterans' Services": "VET",
    "Village": "VIL",
    "Volunteer Ambulance Workers' Benefit": "VAW",
    "Volunteer Firefighters' Benefit": "VOL",
    "Workers' Compensation": "WKC",
}

# Variants: alternate names found in regulation text -> law ID
# Regulations use "and" where API uses "&", drop possessives, etc.
_VARIANTS = {
    # & vs "and"
    "Agriculture and Markets": "AGM",
    "Civil Practice Law and Rules": "CVP",
    "Debtor and Creditor": "DCD",
    "Estates, Powers and Trusts": "EPT",
    "Estates Powers and Trusts": "EPT",
    "Real Property Actions and Proceedings": "RPA",
    "Retirement and Social Security": "RSS",
    "Soil and Water Conservation Districts": "SWC",
    "Vehicle and Traffic": "VAT",
    # Shortened forms
    "Limited Liability Company": "LLC",
    "Not-for-Profit Corporation": "NPC",
    "Not for Profit Corporation": "NPC",
    "Cooperative Corporation": "CCO",
    "Business Corporation": "BSC",
    "Transportation Corporation": "TCP",
    "Religious Corporation": "RCO",
    "Financial Services": "FIS",
    "Economic Development": "COM",
    "Environmental Conservation": "ENV",
    "General Municipal": "GMU",
    "General Business": "GBS",
    "General Obligations": "GOB",
    "General Construction": "GCN",
    "General City": "GCT",
    "Alcoholic Beverage Control": "ABC",
    "Mental Hygiene": "MHY",
    "Public Health": "PBH",
    "Public Officers": "PBO",
    "Public Service": "PBS",
    "Public Authorities": "PBA",
    "Social Services": "SOS",
    "State Finance": "STF",
    "State Administrative Procedure": "SAP",
    "Eminent Domain Procedure": "EDP",
    "Municipal Home Rule": "MHR",
    "Civil Rights": "CVR",
    "Civil Service": "CVS",
    "Domestic Relations": "DOM",
    "Criminal Procedure": "CPL",
    "Workers Compensation": "WKC",
    "Workmen's Compensation": "WKC",
    "Volunteer Firefighters Benefit": "VOL",
    "Volunteer Ambulance Workers Benefit": "VAW",
    # Common single-word laws (often cited as just "the Tax Law")
    "Education": "EDN",
    "Insurance": "ISC",
    "Executive": "EXC",
    "Banking": "BNK",
    "Cannabis": "CAN",
    "Correction": "COR",
    "County": "CNT",
    "Elder": "ELD",
    "Election": "ELN",
    "Energy": "ENG",
    "Highway": "HAY",
    "Indian": "IND",
    "Judiciary": "JUD",
    "Labor": "LAB",
    "Legislative": "LEG",
    "Lien": "LIE",
    "Military": "MIL",
    "Navigation": "NAV",
    "Partnership": "PTR",
    "Penal": "PEN",
    "Railroad": "RRD",
    "State": "STL",
    "Tax": "TAX",
    "Town": "TWN",
    "Transportation": "TRA",
    "Village": "VIL",
    "Canal": "CAL",
    # With "Law" suffix already stripped by regex, but just in case
    "Racing, Pari-Mutuel Wagering and Breeding": "PML",
    "Racing Pari-Mutuel Wagering and Breeding": "PML",
    "Parks, Recreation and Historic Preservation": "PAR",
    "Parks Recreation and Historic Preservation": "PAR",
    "Abandoned Property": "ABP",
    "Personal Property": "PEP",
    "Real Property": "RPP",
    "Real Property Tax": "RPT",
    "Public Lands": "PBL",
    "Public Buildings": "PBB",
    "Public Housing": "PBG",
    "Private Housing Finance": "PVH",
    "Multiple Dwelling": "MDW",
    "Multiple Residence": "MRE",
    "Local Finance": "LFN",
    "Rapid Transit": "RAT",
    "Alternative County Government": "ACG",
    "Municipal Housing Authorities": "MHA",
    "Benevolent Orders": "BVO",
    # "New York" / "New York State" prefixed forms found in regs
    "New York State Education": "EDN",
    "New York Education": "EDN",
    "New York Banking": "BNK",
    "New York State Banking": "BNK",
    "New York Executive": "EXC",
    "New York State Executive": "EXC",
    "New York State Vehicle and Traffic": "VAT",
    "New York Vehicle and Traffic": "VAT",
    "New York Real Property": "RPP",
    "New York State Real Property": "RPP",
    "New York Real Property Tax": "RPT",
    "New York State Real Property Tax": "RPT",
    "New York State Insurance": "ISC",
    "New York Insurance": "ISC",
    "New York Tax": "TAX",
    "New York State Tax": "TAX",
    "New York State Environmental Conservation": "ENV",
    "New York Environmental Conservation": "ENV",
    "New York State Public Health": "PBH",
    "New York Public Health": "PBH",
    # Common alternate names found in regulation text
    "Civil Practice": "CVP",
    "Conservation": "ENV",
    "Environmental": "ENV",
    "Unemployment Insurance": "LAB",  # Part of Labor Law
    "Freedom of Information": "PBO",  # Part of Public Officers Law
    "Pari-Mutuel": "PML",
    "Human Rights": "EXC",  # Article 15 of Executive Law
    "Open Meetings": "PBO",  # Part of Public Officers Law
    "New York State Penal": "PEN",
    "New York Penal": "PEN",
    "New York State Military": "MIL",
    "New York Public Authorities": "PBA",
    "New York State Public Authorities": "PBA",
    "New York State Civil Service": "CVS",
    "New York State Finance": "STF",
    "New York State Social Services": "SOS",
    "New York Social Services": "SOS",
    "Alcohol Beverage Control": "ABC",  # Typo variant of "Alcoholic"
    "New York State Technology": "STT",
    "New York State Labor": "LAB",
    "New York Labor": "LAB",
    "State Education": "EDN",
    "State Finance": "STF",
    "Commerce": "COM",  # Economic Development Law
    "New York State Correction": "COR",
    "New York Correction": "COR",
    "Second Class Cities": "SCC",
    "Statute of Local Governments": "SLG",
    "Arts and Cultural Affairs": "ACA",
    "Veterans Services": "VET",
    "Veterans' Services": "VET",
    "Uniform Commercial Code": "UCC",
    "Printing and Public Documents": "PPD",
    "State Printing and Public Documents": "PPD",
    "Rural Electric Cooperative": "REL",
    "State Technology": "STT",
}


def _build_lookup() -> dict[str, str]:
    """Build a case-insensitive lookup from all name sources."""
    lookup = {}
    for name, law_id in _CANONICAL.items():
        lookup[name.lower()] = law_id
    for name, law_id in _VARIANTS.items():
        lookup[name.lower()] = law_id
    return lookup


_LOOKUP = _build_lookup()


def resolve_law_id(name: str) -> str | None:
    """
    Resolve a law name (as found in regulation text) to a law ID.

    Tries exact match (case-insensitive) against canonical names and known variants.
    Returns None if no match found.

    Args:
        name: Law name extracted from citation (e.g., "Social Services", "Vehicle and Traffic")

    Returns:
        Law ID (e.g., "SOS", "VAT") or None
    """
    return _LOOKUP.get(name.strip().lower())


def get_all_law_ids() -> set[str]:
    """Return set of all known law IDs."""
    return set(_CANONICAL.values())


def get_canonical_name(law_id: str) -> str | None:
    """Get the canonical law name for a law ID."""
    for name, lid in _CANONICAL.items():
        if lid == law_id:
            return name
    return None
