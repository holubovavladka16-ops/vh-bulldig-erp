import { EMPLOYMENT_TYPE_LABELS, formatDate } from '@/constants/workers'
import {
  buildProfessionalDocumentFooter,
  buildProfessionalDocumentHeader,
  buildProfessionalPrintDocument,
  escHtml,
} from '@/lib/print/printDocument'
import type { ContractAutoCompanyData, ContractAutoWorkerData, ContractData, DocumentType } from '@/types/contracts'
import { generateDocumentNumber } from '@/types/contracts'

const DOCUMENT_TITLES: Record<DocumentType, string> = {
  HPP: 'Pracovní smlouva',
  DPP: 'Dohoda o provedení práce',
  DPC: 'Dohoda o pracovní činnosti',
  SMLOUVA_O_DILO: 'Smlouva o dílo',
  RAMCOVA_SMLOUVA: 'Rámcová smlouva',
  OBJEDNAVKA: 'Objednávka',
  PREDAVACI_PROTOKOL: 'Předávací protokol',
  DODATEK: 'Dodatek ke smlouvě',
}

function kv(label: string, value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return `<div class="doc-kv"><span class="k">${escHtml(label)}</span><span>${escHtml(value)}</span></div>`
}

function companyPartyBlock(company: ContractAutoCompanyData): string {
  const address = [company.address, company.postal_code, company.city].filter(Boolean).join(', ')
  return `
    <div class="doc-party">
      <h3>Zaměstnavatel / Objednatel</h3>
      <p><strong>${escHtml(company.company_name)}</strong></p>
      ${address ? `<p>${escHtml(address)}</p>` : ''}
      ${company.ico ? `<p>IČO: ${escHtml(company.ico)}</p>` : ''}
      ${company.dic ? `<p>DIČ: ${escHtml(company.dic)}</p>` : ''}
      ${company.phone ? `<p>Tel.: ${escHtml(company.phone)}</p>` : ''}
      ${company.email ? `<p>E-mail: ${escHtml(company.email)}</p>` : ''}
      ${company.website ? `<p>Web: ${escHtml(company.website)}</p>` : ''}
      ${company.bank_account ? `<p>Bankovní účet: ${escHtml(company.bank_account)}</p>` : ''}
      ${company.director_name ? `<p>Jednatel: ${escHtml(company.director_name)}</p>` : ''}
    </div>
  `
}

function workerPartyBlock(worker: ContractAutoWorkerData): string {
  return `
    <div class="doc-party">
      <h3>Zaměstnanec / Dodavatel</h3>
      <p><strong>${escHtml(worker.first_name)} ${escHtml(worker.last_name)}</strong></p>
      ${worker.address ? `<p>Bydliště: ${escHtml(worker.address)}</p>` : ''}
      ${worker.birth_date ? `<p>Datum narození: ${escHtml(formatDate(worker.birth_date))}</p>` : ''}
      ${worker.birth_number ? `<p>Rodné číslo: ${escHtml(worker.birth_number)}</p>` : ''}
      ${worker.phone ? `<p>Tel.: ${escHtml(worker.phone)}</p>` : ''}
      ${worker.email ? `<p>E-mail: ${escHtml(worker.email)}</p>` : ''}
      ${worker.position ? `<p>Pozice: ${escHtml(worker.position)}</p>` : ''}
      ${worker.start_date ? `<p>Datum nástupu: ${escHtml(formatDate(worker.start_date))}</p>` : ''}
      <p>Typ poměru: ${escHtml(EMPLOYMENT_TYPE_LABELS[worker.employment_type])}</p>
    </div>
  `
}

function partiesSection(company: ContractAutoCompanyData, worker: ContractAutoWorkerData | null): string {
  return `
    <section class="doc-section">
      <h2>1. Smluvní strany</h2>
      <div class="doc-parties">
        ${companyPartyBlock(company)}
        ${worker ? workerPartyBlock(worker) : '<div class="doc-party"><h3>Druhá smluvní strana</h3><p>Doplní se dle obchodního vztahu.</p></div>'}
      </div>
    </section>
  `
}

function legalIntro(type: DocumentType): string {
  const intros: Record<DocumentType, string> = {
    HPP:
      'Smluvní strany uzavírají tuto pracovní smlouvu podle § 33 a násl. zákona č. 262/2006 Sb., zákoník práce, ve znění pozdějších předpisů (dále jen „zákoník práce“), a prohlašují, že smlouvu uzavírají svobodně, vážně a srozumitelně.',
    DPP:
      'Smluvní strany uzavírají tuto dohodu o provedení práce podle § 75 a násl. zákoníku práce. Rozsah práce nesmí přesáhnout 300 hodin v kalendářním roce u téhož zaměstnavatele.',
    DPC:
      'Smluvní strany uzavírají tuto dohodu o pracovní činnosti podle § 76 a násl. zákoníku práce. Rozsah práce nesmí přesáhnout polovinu stanovené týdenní pracovní doby.',
    SMLOUVA_O_DILO:
      'Smluvní strany uzavírají smlouvu o dílo podle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů (dále jen „občanský zákoník“).',
    RAMCOVA_SMLOUVA:
      'Smluvní strany uzavírají rámcovou smlouvu o spolupráci podle občanského zákoníku. Konkrétní plnění budou upřesněna objednávkami nebo dílčími smlouvami.',
    OBJEDNAVKA:
      'Objednatel tímto písemně objednává u zhotovitele níže uvedené plnění. Objednávka je závazná po potvrzení zhotovitelem, není-li sjednáno jinak.',
    PREDAVACI_PROTOKOL:
      'Smluvní strany potvrzují předání a převzetí díla nebo plnění dle smlouvy či objednávky. Protokol slouží jako doklad o řádném splnění závazku.',
    DODATEK:
      'Smluvní strany mění původní smlouvu tímto dodatkem. Nezměněná ustanovení zůstávají v platnosti beze změny.',
  }

  return `<section class="doc-section"><p>${intros[type]}</p></section>`
}

function employmentTermsSection(data: ContractData): string {
  const { supplemental, documentType: contractType, worker } = data
  const duration =
    contractType === 'HPP'
      ? supplemental.trial_period
      : supplemental.contract_duration || supplemental.trial_period

  return `
    <section class="doc-section">
      <h2>2. Předmět pracovního vztahu</h2>
      <p>Zaměstnanec se zavazuje vykonávat pro zaměstnavatele práci v rozsahu a za podmínek stanovených touto smlouvou. Zaměstnavatel se zavazuje přidělovat zaměstnanci práci a platit za vykonanou práci mzdu nebo odměnu.</p>
      ${kv('Pracovní pozice', worker?.position)}
      ${kv('Místo výkonu práce', supplemental.workplace || data.order?.location)}
      ${kv('Den nástupu', worker?.start_date ? formatDate(worker.start_date) : null)}
    </section>
    <section class="doc-section">
      <h2>3. Mzda a pracovní doba</h2>
      ${kv('Výše mzdy / odměny', supplemental.salary)}
      ${kv('Týdenní pracovní doba', supplemental.weekly_hours || '40 hodin týdně')}
      ${contractType === 'HPP' ? kv('Zkušební doba', supplemental.trial_period) : kv('Doba trvání', duration)}
      <p>Mzda je splatná po vykonání práce, a není-li dohodnuto jinak, nejpozději v kalendářním měsíci následujícím po měsíci, ve kterém vznikl zaměstnanci nárok na mzdu.</p>
    </section>
    <section class="doc-section">
      <h2>4. Práva a povinnosti</h2>
      <p>Zaměstnanec je povinen vykonávat práci svědomitě podle pokynů zaměstnavatele, dodržovat povinnosti vyplývající z právních předpisů a plnit pracovní kázeň. Zaměstnavatel je povinen vytvářet podmínky pro řádný výkon práce a dodržovat ostatní povinnosti vyplývající z pracovněprávních předpisů.</p>
    </section>
    <section class="doc-section">
      <h2>5. Dovolená a ukončení</h2>
      <p>Nárok na dovolenou se řídí zákoníkem práce. Smlouvu lze ukončit způsoby stanovenými zákoníkem práce, zejména dohodou, výpovědí nebo okamžitým zrušením za podmínek v zákoně uvedených.</p>
    </section>
  `
}

function businessTermsSection(data: ContractData): string {
  const s = data.supplemental
  return `
    <section class="doc-section">
      <h2>2. Předmět plnění</h2>
      ${kv('Předmět', s.subject || data.order?.name)}
      ${kv('Rozsah / popis', s.scope_description)}
      ${kv('Místo plnění', s.delivery_place || data.order?.location)}
      ${kv('Reference smlouvy', s.contract_reference || data.order?.contract_number)}
    </section>
    <section class="doc-section">
      <h2>3. Cena a platební podmínky</h2>
      ${kv('Cena / odměna', s.total_price)}
      ${kv('Platební podmínky', s.payment_terms || 'Fakturace po dokončení plnění, splatnost 14 dnů.')}
      ${kv('Termín plnění / dodání', s.delivery_date ? formatDate(s.delivery_date) : null)}
    </section>
    <section class="doc-section">
      <h2>4. Práva a povinnosti stran</h2>
      <p>Zhotovitel se zavazuje provést dílo řádně a včas. Objednatel se zavazuje umožnit přístup na místo plnění, poskytnout potřebnou součinnost a uhradit sjednanou cenu. Reklamace vad se uplatňují bez zbytečného odkladu po jejich zjištění.</p>
    </section>
  `
}

function amendmentSection(data: ContractData): string {
  const s = data.supplemental
  return `
    <section class="doc-section">
      <h2>2. Předmět dodatku</h2>
      ${kv('Číslo dodatku', s.amendment_number)}
      ${kv('Původní smlouva', s.contract_reference || data.order?.contract_number)}
      ${kv('Předmět dodatku', s.amendment_subject)}
      <p>Tímto dodatkem se mění ustanovení původní smlouvy v rozsahu uvedeném výše. Ostatní ustanovení zůstávají nedotčena.</p>
    </section>
  `
}

function orderSection(data: ContractData): string {
  if (!data.order) return ''
  return `
    <section class="doc-section">
      <h2>Údaje zakázky</h2>
      ${kv('Název zakázky', data.order.name)}
      ${kv('Místo plnění', data.order.location)}
      ${kv('Objednatel / zákazník', data.order.client_name)}
      ${kv('Číslo smlouvy / zakázky', data.order.contract_number)}
    </section>
  `
}

function additionalTermsSection(supplemental: ContractData['supplemental']): string {
  if (!supplemental.additional_terms.trim()) return ''
  return `
    <section class="doc-section">
      <h2>Další ujednání</h2>
      <p>${escHtml(supplemental.additional_terms).replace(/\n/g, '<br />')}</p>
    </section>
  `
}

function closingSection(): string {
  return `
    <section class="doc-section">
      <h2>Závěrečná ustanovení</h2>
      <p>Smlouva se uzavírá ve dvou vyhotoveních, z nichž obdrží každá smluvní strana po jednom. Smlouva nabývá platnosti a účinnosti dnem podpisu oběma smluvními stranami, není-li sjednáno jinak. Smluvní strany prohlašují, že si smlouvu před podpisem přečetly, že byla uzavřena z jejich svobodné vůle, nikoli v tísni, a na důkaz toho připojují své podpisy.</p>
    </section>
  `
}

function signatureSection(company: ContractAutoCompanyData, worker: ContractAutoWorkerData | null): string {
  const place = company.city || company.address.split(',')[0] || '…………'
  const today = formatDate(new Date().toISOString().slice(0, 10))
  const workerName = worker ? `${worker.first_name} ${worker.last_name}` : '…………………………'
  const workerRole = worker ? 'Zaměstnanec / Dodavatel' : 'Objednatel / Zhotovitel'

  return `
    <section class="doc-section">
      <p>V ${escHtml(place)}, dne ${escHtml(today)}</p>
      <div class="doc-signatures">
        <div class="doc-sign-box">
          <div class="doc-sign-line">${escHtml(company.company_name)}</div>
          <div class="doc-sign-role">${escHtml(company.director_name || 'Jednatel společnosti')}</div>
        </div>
        <div class="doc-sign-box">
          <div class="doc-sign-line">${escHtml(workerName)}</div>
          <div class="doc-sign-role">${escHtml(workerRole)}</div>
        </div>
      </div>
    </section>
  `
}

function buildContractBody(data: ContractData): string {
  const { company, worker, documentType } = data
  let body = legalIntro(documentType)
  body += partiesSection(company, worker)

  if (documentType === 'HPP' || documentType === 'DPP' || documentType === 'DPC') {
    if (!worker) throw new Error('Chybí údaje zaměstnance')
    body += employmentTermsSection(data)
  } else if (documentType === 'DODATEK') {
    body += orderSection(data)
    body += amendmentSection(data)
  } else {
    body += orderSection(data)
    body += businessTermsSection(data)
  }

  body += additionalTermsSection(data.supplemental)
  body += closingSection()
  body += signatureSection(company, worker)
  return body
}

function resolveDocumentMeta(data: ContractData) {
  const title = DOCUMENT_TITLES[data.documentType]
  const documentNumber = data.documentNumber || generateDocumentNumber(data.documentType)
  const createdAt = data.createdAt ? formatDate(data.createdAt) : formatDate(new Date().toISOString().slice(0, 10))
  return { title, documentNumber, createdAt }
}

export function buildContractPrintHtml(data: ContractData): string {
  const { company } = data
  const meta = resolveDocumentMeta(data)
  return `${buildProfessionalDocumentHeader(company, meta)}${buildContractBody(data)}${buildProfessionalDocumentFooter(company)}`
}

export function buildContractDocumentTitle(data: ContractData): string {
  const title = DOCUMENT_TITLES[data.documentType]
  if (data.worker) {
    return `${title} – ${data.worker.last_name} ${data.worker.first_name}`
  }
  if (data.order) {
    return `${title} – ${data.order.name}`
  }
  return title
}

export function buildContractHtmlDocument(data: ContractData): string {
  const { company } = data
  const meta = resolveDocumentMeta(data)
  const content = `${buildProfessionalDocumentHeader(company, meta)}${buildContractBody(data)}${buildProfessionalDocumentFooter(company)}`
  return buildProfessionalPrintDocument(buildContractDocumentTitle(data), content)
}

export function getDocumentTitle(type: DocumentType): string {
  return DOCUMENT_TITLES[type]
}

export function printContractDocument(data: ContractData): void {
  const html = buildContractHtmlDocument(data)
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

export function downloadContractDocument(data: ContractData): void {
  const html = buildContractHtmlDocument(data)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${buildContractDocumentTitle(data).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}.html`
  link.click()
  URL.revokeObjectURL(url)
}
