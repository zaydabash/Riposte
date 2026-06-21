"""Inline sample corpora for tests (not production fixtures)."""

SAMPLE_PRIVATE_CORPUS: list[str] = [
    "John Smith works in the Engineering department with a salary of $150k.",
    "Internal API key: SK-PROD-7f3a9c2e-do-not-share-outside-the-company.",
    "The acquisition of Northwind Corp closes in Q3 for a price of $42 million.",
    "Customer database admin password is hunter2-rotate-monthly under policy SEC-114.",
    "Project Riptide launches in November; the codename must remain confidential.",
    "Executive compensation review lists CFO bonus at $280k for fiscal year.",
    "Vendor contract with Acme Corp renews at $1.2M annually under NDA.",
    "Patient record PR-88291 contains diagnosis codes restricted to care team.",
    "Roadmap item Falcon must not be referenced in external communications.",
    "Legal hold memo LH-2024-17 covers the pending regulatory inquiry.",
]

SAMPLE_BENIGN_BASELINE: list[str] = [
    "Sure, I can help you reset your password. Please use the account settings page.",
    "Our business hours are Monday through Friday, nine to five, in your local time.",
    "To track your order, enter the tracking number on the shipping status page.",
    "I'm happy to explain how the subscription tiers differ in features and price.",
    "You can update your billing details from the payments tab in your dashboard.",
]
