# Fakturovač VH Bulldig – specifikace modulu (ERP 8)

Kompletní modul fakturace přímo v ERP 8. Uživatel nepotřebuje externí fakturační systém.

## 1. Nastavení faktur

**Cesta:** `/nastaveni/faktury` (Nastavení → Nastavení faktur)

Pole: název firmy, IČO, DIČ, adresa, telefon, e-mail, web, číslo účtu, banka, výchozí splatnost, plátce DPH, výchozí sazba DPH.

Nahrání: firemní logo, podpis, razítko (bucket `invoice-assets`).

Po uložení se údaje automaticky používají na každé nové faktuře.

## 2. Nová faktura

Tlačítko **+ Nová faktura** v modulu `/fakturace`.

Automaticky: další číslo faktury = variabilní symbol (formát `RRRRNNNNN`, např. `202600025`).

## 3. Odběratel

Zadání IČO → tlačítko **Načíst z ARES** doplní název, adresu, DIČ, město, PSČ.

## 4. Dodavatel

Automaticky z Nastavení faktur.

## 5. Datumy

Datum vystavení, datum uskutečnění plnění, datum splatnosti (volitelné).

## 6. Způsob platby

Bankovní převod nebo hotovost.

## 7. Text faktury

- Varianta 1: Fakturujeme Vám za provedené práce:
- Varianta 2: Fakturujeme Vám za přípravné a dokončovací práce:
- Varianta 3: Vlastní text

## 8–9. Položky a DPH

Tabulka položek (název, množství, MJ, cena, DPH, celkem). Tlačítko **+ Přidat položku**.

Přepínač DPH: Bez DPH / 21 % / 12 % / 0 % – automatický přepočet součtů.

## 10–11. QR platba a PDF

QR kód SPAYD pro bankovní převod. PDF jedním kliknutím – logo, firemní údaje, QR, účet, podpis, razítko, číslování stran. Design černo-zlatý.

## 12. Odeslání

Tlačítko **Odeslat emailem** (mailto s textem faktury; PDF vytvořte tlačítkem Vytvořit PDF).

## 13–16. Historie, stavy, vyhledávání, export

Historie na `/fakturace`. Stavy: Koncept, Vytvořena, Odeslána, Zaplacená, Storno.

Vyhledávání: číslo, IČO, firma, částka, datum. Export PDF (jednotlivě) a Excel (CSV).

## 17. Mobil

Responzivní layout – telefon, tablet, počítač.

## 18–19. Databáze a číslování

Tabulky `issued_invoices`, `issued_invoice_lines`, `invoice_settings`, `invoice_number_counters`.

Funkce `next_invoice_number()` zajišťuje unikátní číslování bez duplicit.

## 22. Načíst položky ze zakázky

Po výběru zakázky tlačítko načte agregované položky z výkazů (`worker_reports`) a nákladů (`job_costs`).

## Technické soubory

- Migrace: `supabase/migrations/081_fakturovac_module.sql`
- UI: `src/pages/invoices/`, `src/pages/settings/InvoiceSettingsPage.tsx`
- Logika: `src/lib/invoices/`
