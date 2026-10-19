# Real samples

Ground truth for formats and test fixtures. Private: contains real names and phone numbers.

| File | What it is | Used by |
|---|---|---|
| `wv-food-schedule-sep-municipality.xlsx` | WV monthly food schedule (Excel). Price-in-header package columns with typos (`Snakc 85`, `Lunch-\n430`), flipped dates (`2026-07-09` = 7 Sep), text dates (`13/9/26`), phones stored as floats, `???` venues, a second older sheet and a phone sheet | Excel import (Seg 9) |
| `wv-food-schedule-sep26-pfa6.pdf` | WV food schedule as PDF: SL, Date, Log Code, Activity, package columns with prices (Snacks Basic-2 50, Basic-3 100, Premium-1 160, Lunch Standard-2 400), Place, Time, Facilitator, Mobile; totals block. Totals: 156/205/397/27, ৳102,620 | AI intake (Seg 12), fixtures |
| `wv-purchase-order-PBD-2794325.png` | Photo of a WV Purchase Order: 2 lines (Snacks Single Item-17 ×9 @60; Lunch Basic-07 ×9 @355), total 3,735 BDT, payment terms 15D, ship-to REACTS-IN | AI intake (Seg 12) |
| `wv-venue-list.png` | WV activity venue list: 25 house venues, "10+2" participants, CF names and phones | Import quirks (`10+2`) |
| `bill-challans-reacts-in-aug18.pdf` | Legacy app output: bill (6 packages, ৳69,270) + challans (Puraton Hospital) + summary | Document design (Seg 5), page editor (Seg 6) |
| `bill-challans-ap-aug17.pdf` | Legacy app output: bill (৳119,750) + challans per location/date + summary | Document design (Seg 5) |
| `datasheet-8-august.pdf`, `datasheet-11-july.pdf` | Bangla datasheets for delivery boys: day blocks, price groups with vertical labels, qty / location / contact / phone, group totals, two columns | Datasheet (Seg 8) |
| `handwritten-note-1.png`, `handwritten-note-2.png` | Orders written by hand in Bangla (prices as package identity: "৪০০ টাকার প্যাকেট", "৫২০ টাকা", "৪৭ প্যাকেট + ৩ প্রাণি") | Quick entry / AI intake |
| `wv-package-list-1.png` … `-6.png` | Photos of WV's comparative bid analysis — the source of the new package list (30 items, total 5,444) | Source for `../packages-new.xlsx` |
| `voucher-pad.png` | The hotel's printed paper voucher | Branding reference |

## Bank SMS format (account and balance masked)

```
PUBALI BANK
29/09/2026  12:55 PM

BDT 78669.74 has been credited to your a/c ***XXXX through EFT STANDARD CHARTERED B,PBD2778470,WVBNORTHWESTC on 29-SEP-26. A/C Bal:XXXXXX.XX
```

`PBD2778470` is the WV PO number without its hyphen. The amount is net of tax deducted at source.
