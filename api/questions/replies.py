"""Ask Tally's pre-written replies (SPEC §6): greetings, help, thanks, explanations of Tally's own terms, and
the polite refusal for anything outside its scope.

The model only picks WHICH reply fits (llm.question_picker); every word here is fixed text, in English or
Filipino/Taglish to match how the Reviewer wrote. Nothing in a reply is generated, so a reply can never invent
a number, a tax rule or a policy, and nothing the Reviewer types can change what Tally says.
"""
from typing import Literal

Lang = Literal["en", "fil"]

# One clickable question per Supported Question (SPEC §6), worded so the picker routes it back correctly.
SUGGESTIONS: dict[Lang, list[str]] = {
    "en": [
        "What still needs my review?",
        "How much input VAT did we lose this month, and why?",
        "How much does each employee need to return?",
        "Which cash advances are still open after 30 days?",
        "How much did we spend per category this quarter?",
        "Which suppliers have the most invalid receipts?",
        "Which receipts were submitted twice?",
    ],
    "fil": [
        "Ano pa ang kailangan kong i-review?",
        "Magkano ang nawalang input VAT ngayong buwan, at bakit?",
        "Magkano ang ibabalik ng bawat empleyado?",
        "Aling cash advance ang hindi pa na-liquidate after 30 days?",
        "Magkano ang nagastos per category this quarter?",
        "Aling supplier ang may pinakamaraming invalid na resibo?",
        "May resibo bang dalawang beses na-submit?",
    ],
}

INTRO: dict[Lang, dict] = {
    "en": {
        "sentence": "Hi! I'm Tally. I read your receipts and answer questions about your company's cash advances, "
                    "right here on this computer. Your data never leaves it.",
        "body": ["Here's what you can ask me:"],
        "note": "You can also ask what a term means, like \"What is input VAT?\"",
    },
    "fil": {
        "sentence": "Hello! Ako si Tally. Binabasa ko ang inyong mga resibo at sinasagot ang mga tanong tungkol sa "
                    "cash advances ng kumpanya, dito mismo sa computer na ito. Hindi lumalabas ang inyong data.",
        "body": ["Puwede ninyo akong tanungin ng:"],
        "note": "Puwede rin ninyong itanong kung ano ang ibig sabihin ng isang term, gaya ng \"Ano ang input VAT?\"",
    },
}

GREETING_AGAIN: dict[Lang, str] = {
    "en": "Hi again! What would you like to know?",
    "fil": "Hello ulit! Ano ang gusto ninyong malaman?",
}

THANKS: dict[Lang, str] = {
    "en": "You're welcome! Ask me anytime.",
    "fil": "Walang anuman! Magtanong lang kayo anytime.",
}

OFF_TOPIC: dict[Lang, str] = {
    "en": "Sorry, I can only help with your company's cash advances, receipts and liquidations. Try one of these:",
    "fil": "Pasensya na, ang matutulungan ko lang ay ang cash advances, resibo at liquidations ng inyong kumpanya. "
           "Subukan ang isa sa mga ito:",
}

# Tally's own terms, from GLOSSARY.md and SPEC §5. Keys are the picker's topic enum.
TOPICS: dict[str, dict[Lang, tuple[str, list[str]]]] = {
    "INPUT_VAT": {
        "en": ("Input VAT is the 12% VAT your company pays on purchases.", [
            "A VAT-registered company can claim it against the VAT it owes, but only with a valid Invoice that "
            "carries the company's name and TIN.",
            "\"Lost input VAT\" is VAT on receipts that were rejected or can't be claimed, so the company can't "
            "deduct it. Ask \"How much input VAT did we lose this month?\" to see it.",
        ]),
        "fil": ("Ang input VAT ay ang 12% VAT na binabayaran ng kumpanya sa mga binibili nito.", [
            "Puwede itong i-claim ng kumpanyang VAT-registered laban sa VAT na dapat nitong bayaran, pero kailangan "
            "ng valid na Invoice na may pangalan at TIN ng kumpanya.",
            "Ang \"nawalang input VAT\" ay VAT sa mga resibong na-reject o hindi puwedeng i-claim. Itanong ang "
            "\"Magkano ang nawalang input VAT ngayong buwan?\" para makita ito.",
        ]),
    },
    "SEVERITIES": {
        "en": ("Every problem Tally finds on a receipt has one of three levels.", [
            "Reject: the receipt's whole amount is disallowed.",
            "Needs review: you must check it and resolve it before you can approve the liquidation.",
            "No input VAT: the spend counts, but its VAT can't be claimed.",
            "A receipt with no problems is Accepted.",
        ]),
        "fil": ("May tatlong antas ang bawat problemang nakikita ni Tally sa isang resibo.", [
            "Reject: hindi tatanggapin ang buong halaga ng resibo.",
            "Needs review: kailangan ninyo itong tingnan at ayusin bago ma-approve ang liquidation.",
            "No input VAT: bilang ang gastos, pero hindi puwedeng i-claim ang VAT nito.",
            "Accepted ang resibong walang problema.",
        ]),
    },
    "WHY_REJECTED": {
        "en": ("Tally runs six checks on every receipt.", [
            "1. Document type: it must be an Invoice. Official Receipts and foreign documents are rejected.",
            "2. Seller TIN: it must be readable, with its branch code.",
            "3. Buyer details: the company's name and TIN, as your Buyer Details Rule requires.",
            "4. VAT arithmetic: VATable sales × 12% must equal the VAT, and the parts must add up to the total.",
            "5. Duplicate: the same receipt can't be submitted twice.",
            "6. Date: it must fall inside the cash advance's Spending Period.",
            "Open the receipt to see exactly which check it failed.",
        ]),
        "fil": ("Anim na check ang ginagawa ni Tally sa bawat resibo.", [
            "1. Uri ng dokumento: dapat Invoice. Rejected ang Official Receipt at foreign na dokumento.",
            "2. Seller TIN: dapat nababasa, kasama ang branch code.",
            "3. Buyer details: pangalan at TIN ng kumpanya, ayon sa inyong Buyer Details Rule.",
            "4. VAT arithmetic: VATable sales × 12% ay dapat katumbas ng VAT, at dapat tumugma ang kabuuan.",
            "5. Duplicate: hindi puwedeng i-submit ang parehong resibo nang dalawang beses.",
            "6. Petsa: dapat pasok sa Spending Period ng cash advance.",
            "Buksan ang resibo para makita kung aling check ang hindi pumasa.",
        ]),
    },
    "INVOICE_VS_OR": {
        "en": ("Since the EOPT Act (2024), only an Invoice proves a purchase and supports claiming input VAT.", [
            "An Official Receipt (OR) is the older document type. It's no longer valid for claiming input VAT, so "
            "Tally rejects it.",
        ]),
        "fil": ("Mula sa EOPT Act (2024), Invoice na lang ang patunay ng pagbili at puwedeng gamitin sa input VAT.", [
            "Ang Official Receipt (OR) ay ang lumang uri ng dokumento. Hindi na ito valid para sa input VAT, kaya "
            "nire-reject ito ni Tally.",
        ]),
    },
    "BUYER_DETAILS_RULE": {
        "en": ("The Buyer Details Rule says which receipts must show your company's name and TIN.", [
            "Either all receipts, or only receipts of ₱1,000 and above (the legal minimum). You choose it in Settings.",
            "A receipt with another company's TIN, or with the buyer line blank when it's required, is rejected.",
        ]),
        "fil": ("Ang Buyer Details Rule ang nagsasabi kung aling resibo ang dapat may pangalan at TIN ng kumpanya.", [
            "Puwedeng lahat ng resibo, o resibong ₱1,000 pataas lang (ang legal na minimum). Pinipili ito sa Settings.",
            "Rejected ang resibong may ibang TIN ng kumpanya, o blangko ang buyer line kung kailangan ito.",
        ]),
    },
    "SELLER_TIN": {
        "en": ("The seller TIN is the store's tax number: 9 digits plus a 3 to 5 digit branch code.", [
            "Tally needs it to show the receipt is from a registered seller. If it's missing or unreadable, the "
            "receipt goes to Needs review so you can check it.",
        ]),
        "fil": ("Ang seller TIN ay ang tax number ng tindahan: 9 na digit at 3 hanggang 5 digit na branch code.", [
            "Kailangan ito ni Tally para patunayang registered ang seller. Kung wala o hindi mabasa, mapupunta ang "
            "resibo sa Needs review para ma-check ninyo.",
        ]),
    },
    "SPENDING_PERIOD": {
        "en": ("The Spending Period is the dates a cash advance may be spent in.", [
            "It runs from the release date to the spending end date, both included. Receipts dated outside it are "
            "rejected.",
        ]),
        "fil": ("Ang Spending Period ay ang mga petsa kung kailan puwedeng gastusin ang cash advance.", [
            "Mula release date hanggang spending end date, kasama ang dalawa. Rejected ang resibong may petsang "
            "labas dito.",
        ]),
    },
    "RETURN_VS_EXCESS": {
        "en": ("These compare the cash advance with the valid spend.", [
            "Amount to Return: the employee spent less than the advance, so they give back the difference.",
            "Excess Spend: the employee spent more than the advance, and may claim it back, subject to approval.",
            "Ask \"How much does each employee need to return?\" to see the amounts.",
        ]),
        "fil": ("Ikinukumpara nito ang cash advance at ang valid na gastos.", [
            "Amount to Return: mas mababa ang nagastos kaysa sa advance, kaya ibabalik ng empleyado ang sobra.",
            "Excess Spend: mas mataas ang nagastos kaysa sa advance, at puwede itong i-claim kung ma-approve.",
            "Itanong ang \"Magkano ang ibabalik ng bawat empleyado?\" para makita ang mga halaga.",
        ]),
    },
    "LIQUIDATION": {
        "en": ("A liquidation is the set of receipts an employee submits to account for one cash advance.", [
            "You review its receipts, then either approve it, which makes its totals final, or return it to the "
            "employee with the open problems as reasons, to be completed and reviewed again.",
        ]),
        "fil": ("Ang liquidation ay ang mga resibong isinusumite ng empleyado para sa isang cash advance.", [
            "Rine-review ninyo ang mga resibo, tapos i-a-approve ito (final na ang totals) o ibabalik sa empleyado "
            "kasama ang mga natitirang problema, para kumpletuhin at i-review ulit.",
        ]),
    },
    "SLSP": {
        "en": ("The SLSP export is a CSV of your purchases for the BIR Summary List of Purchases.", [
            "It lists each valid receipt's seller TIN, amounts and VAT for the month, ready to bring into your "
            "SLSP filing. Download it from the SLSP purchases card on the Cash Advances page.",
        ]),
        "fil": ("Ang SLSP export ay CSV ng inyong mga binili para sa BIR Summary List of Purchases.", [
            "Nakalista rito ang seller TIN, halaga at VAT ng bawat valid na resibo sa buwan, handa para sa inyong "
            "SLSP filing. I-download ito sa SLSP purchases card sa Cash Advances page.",
        ]),
    },
    "DISMISSAL": {
        "en": ("Dismissing a finding means you decided it doesn't apply to this receipt.", [
            "A reason is required. The finding stays visible as dismissed, so the decision is on record, and it "
            "no longer counts against the receipt.",
        ]),
        "fil": ("Ang pag-dismiss ng finding ay pagpapasya ninyong hindi ito tumutukoy sa resibong ito.", [
            "Kailangan ng dahilan. Makikita pa rin ang finding bilang dismissed para nakatala ang desisyon, at hindi "
            "na ito bibilangin laban sa resibo.",
        ]),
    },
    "PHONE_CAPTURE": {
        "en": ("You can photograph receipts with a phone instead of uploading files.", [
            "Open a liquidation and scan the QR code with a phone on the same Wi-Fi as this computer. Photos go "
            "straight to this computer, never to the internet.",
        ]),
        "fil": ("Puwede ninyong kunan ng litrato ang mga resibo gamit ang phone sa halip na mag-upload.", [
            "Buksan ang isang liquidation at i-scan ang QR code gamit ang phone na nasa parehong Wi-Fi ng computer "
            "na ito. Diretso sa computer na ito ang mga litrato, hindi sa internet.",
        ]),
    },
}


def _reply(sentence: str, body: list[str] | None = None, suggestions: list[str] | None = None,
           note: str | None = None) -> dict:
    return {"kind": "reply", "sentence": sentence, "body": body or [], "suggestions": suggestions or [],
            "note": note}


def intro(lang: Lang = "en") -> dict:
    t = INTRO[lang]
    return _reply(t["sentence"], t["body"], SUGGESTIONS[lang], t["note"])


def greeting(lang: Lang, first: bool) -> dict:
    return intro(lang) if first else _reply(GREETING_AGAIN[lang])


def thanks(lang: Lang) -> dict:
    return _reply(THANKS[lang])


def off_topic(lang: Lang) -> dict:
    return _reply(OFF_TOPIC[lang], suggestions=SUGGESTIONS[lang][:4])


def explain(topic: str, lang: Lang) -> dict:
    if topic not in TOPICS:
        return off_topic(lang)
    sentence, body = TOPICS[topic][lang]
    return _reply(sentence, body)
