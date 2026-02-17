-- Allow NYC in compliance_issues state check constraint
ALTER TABLE compliance_issues DROP CONSTRAINT compliance_issues_state_check;
ALTER TABLE compliance_issues ADD CONSTRAINT compliance_issues_state_check
    CHECK (state IN ('NY', 'NJ', 'NYC'));
