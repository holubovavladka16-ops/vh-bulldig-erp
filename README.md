# VH Bulldig ERP – Modul 1

Profesionální základ ERP platformy pro **VH Bulldig s.r.o.**

## Modul 1 – Základ systému

- Design systém (glassmorphism, neon glow, rotace akcentů)
- Přihlášení, dashboard, levé menu, horní lišta
- Nastavení společnosti, profil administrátora, role uživatelů
- Automatické ukládání, tmavý/světlý režim
- 12 připravených modulů (prázdné stránky)

## Spuštění

```bash
cd vh-bulldig-erp
npm install
cp .env.example .env
npm run dev
```

## Supabase migrace (v pořadí)

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_module1_settings.sql`
3. `supabase/migrations/003_module1_registry.sql`
4. `supabase/migrations/004_module2_delnici.sql`
5. `supabase/migrations/005_module2_storage.sql`
6. `supabase/migrations/006_module2_work_types.sql`
7. `supabase/migrations/007_module3_osobni_cenik.sql`
8. `supabase/migrations/008_module4_formular.sql`
9. `supabase/migrations/009_module5_dochazka_vykazy.sql`
10. `supabase/migrations/010_module6_zakazky.sql`
11. `supabase/migrations/011_module7_naklady.sql`
12. `supabase/migrations/012_automaticke_smlouvy.sql`
13. `supabase/migrations/013_module9_fotodokumentace.sql`
14. `supabase/migrations/014_module10_stavebni_denik.sql`
15. `supabase/migrations/015_module11_pripojky.sql`

## Modul 11 – Přípojky

- Modul **Přípojky** (`/pripojky`) – evidence přípojek na zakázkách
- Povinná pole: datum, zaměstnanec, zakázka, adresa, popis, délka (m), počet průrazů
- Fotodokumentace max. 4 fotky (2× před / 2× po) s GPS a adresou
- CRUD (administrátor), filtry podle zakázky a data
- Typ práce **Přípojka** → automatický zápis ve Stavebním deníku (bez duplicit)

## Modul 10 – Stavební deník

- Modul **Stavební deník** (`/denik`) – denní zápisy ze stavby
- Povinná pole: datum, zakázka, počasí, počet dělníků, jména, technika, popis prací
- Fotodokumentace pořízená v aplikaci s GPS a adresou, uložená se zápisem
- CRUD (administrátor), filtry podle zakázky a data
- Export PDF (A4), sdílení WhatsApp / Messenger / e-mail

## Modul 9 – Fotodokumentace s GPS

- Modul **Fotodokumentace** (`/fotky`) – pořizování fotek s GPS a adresou
- Vyfotit nebo vybrat z galerie; automaticky datum, čas, GPS, adresa (ulice, město, PSČ, stát)
- Mapa a Street View u každé fotografie
- Poznámka, historie, PDF report (A4), sdílení WhatsApp / Messenger / e-mail
- Propojení se zakázkou, zaměstnancem, denním výkazem a stavebním deníkem (připraveno)

## Automatické vyplnění pracovní smlouvy

- V kartě zaměstnance → **Dokumenty** → **Vytvořit smlouvu** (HPP, DPP, DPČ)
- Automaticky z karty: jméno, adresa, kontakt, pozice, poměr, nástup
- Automaticky ze společnosti: název, logo, IČO, DIČ, adresa, kontakt, účet, jednatel
- Administrátor doplní pouze chybějící smluvní údaje (mzda, místo výkonu, …)
- Náhled / tisk a uložení do dokumentů zaměstnance

## Modul 7 – Náklady

- Modul **Náklady** (`/ekonomika`) – evidence nákladů na zakázkách
- Povinná pole: datum, zakázka, název nákladu, cena
- Volitelná pole: dodavatel, poznámka, doklad PDF, fotografie
- Přehled v tabulce s filtry podle zakázky a data
- CRUD: přidat, upravit, smazat (pouze administrátor, bez ukázkových dat)

## Modul 6 – Zakázky

- Modul **Zakázky** (`/zakazky`) – správa stavebních zakázek
- Povinná a volitelná pole, stavy (Připravuje se → Archivovaná)
- Detail zakázky: zaměstnanci, docházka, výkazy, zálohy, fotografie, PDF dokumenty
- Filtry podle názvu, místa, období a stavu; vyhledávání
- Ve formuláři zaměstnance pouze **aktivní** zakázky; automatické propojení po odeslání
- CRUD: přidat, upravit, archivovat, smazat (bez ukázkových dat)

## Modul 5 – Docházka a denní výkazy

- Modul **Docházka** (`/dochazka`) – evidence odpracovaného času ze formulářů
- Modul **Denní výkazy** (`/vykazy`) – automatické výkazy s výkony, cenami, GPS, podpisem
- Portál zaměstnance: Moje docházka, Moje denní výkazy
- Filtry, vyhledávání, řazení, export Excel, tisk PDF
- Administrátor: otevřít, upravit, schválit, vrátit k opravě, smazat

## Modul 3 – Osobní ceník zaměstnance

- Automatické vytvoření osobního ceníku při registraci zaměstnance (8 výchozích položek)
- Správa cen, přidávání/mazání položek, řazení, aktivace/deaktivace
- Propojení s formuláři, výkazy, docházkou, výpočtem výkonů a mzdami

## Modul 4 – Formulář zaměstnance (denní výkaz)

- Mobilní formulář na unikátním odkazu `/portal/{token}` bez přihlášení
- Sdílení odkazu: WhatsApp, Messenger, e-mail, kopírování
- Automatické načtení údajů z karty zaměstnance (včetně zakázky a ceníku)
- Docházka: datum, začátek, konec, přestávka
- Výkony z osobního ceníku s automatickým výpočtem cen
- Denní záloha, materiál, poznámka, fotografie, GPS, podpis
- Odeslání → docházka, výkaz, statistiky, historie (propojení na zakázky/mzdy připraveno)
- Po odeslání formulář zamčen; administrátor může upravit, schválit nebo vrátit k opravě

## Modul 2 – Dělníci

- Seznam zaměstnanců s vyhledáváním a filtry
- Registrace zaměstnance s automatickým ceníkem
- Karta zaměstnance (7 záložek)
- Portál zaměstnance: `/portal/{token}`
- Automatické propojení formulář → výkazy, docházka, statistiky

## Moduly ERP (připraveno)

Dělníci · Docházka · Denní formuláře · Zakázky · Výkazy · Deník · Ekonomika · Přípojky · Fotky · Dokumenty · Statistiky · Nastavení
