import { EMPLOYMENT_TYPE_LABELS, formatDate } from '@/constants/workers'
import { escHtml } from '@/lib/print/printDocument'
import type {
  ContractAutoCompanyData,
  ContractAutoWorkerData,
  ContractData,
  ContractOrderData,
  DocumentType,
} from '@/types/contracts'

export function kv(label: string, value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return `<div class="doc-kv"><span class="k">${escHtml(label)}</span><span>${escHtml(value)}</span></div>`
}

export function companyPartyBlock(company: ContractAutoCompanyData, heading = 'Zaměstnavatel'): string {
  const address = [company.address, company.postal_code, company.city].filter(Boolean).join(', ')
  return `
    <div class="doc-party">
      <h3>${escHtml(heading)}</h3>
      <p><strong>${escHtml(company.company_name)}</strong></p>
      ${company.tagline ? `<p><em>${escHtml(company.tagline)}</em></p>` : ''}
      ${address ? `<p>Sídlo: ${escHtml(address)}</p>` : ''}
      ${company.ico ? `<p>IČO: ${escHtml(company.ico)}</p>` : ''}
      ${company.dic ? `<p>DIČ: ${escHtml(company.dic)}</p>` : ''}
      ${company.phone ? `<p>Tel.: ${escHtml(company.phone)}</p>` : ''}
      ${company.email ? `<p>E-mail: ${escHtml(company.email)}</p>` : ''}
      ${company.website ? `<p>Web: ${escHtml(company.website)}</p>` : ''}
      ${company.bank_account ? `<p>Bankovní spojení: ${escHtml(company.bank_account)}</p>` : ''}
      <p>Zastoupen: ${escHtml(company.director_name || 'jednatel společnosti')}</p>
    </div>
  `
}

export function workerPartyBlock(worker: ContractAutoWorkerData): string {
  return `
    <div class="doc-party">
      <h3>Zaměstnanec</h3>
      <p><strong>${escHtml(worker.first_name)} ${escHtml(worker.last_name)}</strong></p>
      ${worker.address ? `<p>Bydliště: ${escHtml(worker.address)}</p>` : ''}
      ${worker.birth_date ? `<p>Datum narození: ${escHtml(formatDate(worker.birth_date))}</p>` : ''}
      ${worker.birth_number ? `<p>Rodné číslo: ${escHtml(worker.birth_number)}</p>` : ''}
      ${worker.phone ? `<p>Tel.: ${escHtml(worker.phone)}</p>` : ''}
      ${worker.email ? `<p>E-mail: ${escHtml(worker.email)}</p>` : ''}
      ${worker.position ? `<p>Sjednaná pozice: ${escHtml(worker.position)}</p>` : ''}
      <p>Typ poměru: ${escHtml(EMPLOYMENT_TYPE_LABELS[worker.employment_type])}</p>
    </div>
  `
}

export function clientPartyBlock(order: ContractOrderData, heading = 'Objednatel'): string {
  return `
    <div class="doc-party">
      <h3>${escHtml(heading)}</h3>
      <p><strong>${escHtml(order.client_name || 'Objednatel dle smluvního vztahu')}</strong></p>
      ${order.location ? `<p>Místo plnění: ${escHtml(order.location)}</p>` : ''}
      ${order.contract_number ? `<p>Reference: ${escHtml(order.contract_number)}</p>` : ''}
    </div>
  `
}

export function contractorPartyBlock(company: ContractAutoCompanyData): string {
  return companyPartyBlock(company, 'Zhotovitel')
}

export function legalIntro(type: DocumentType): string {
  const intros: Record<DocumentType, string> = {
    HPP:
      'Zaměstnavatel a zaměstnanec (dále společně jen „smluvní strany“) uzavírají tuto pracovní smlouvu podle § 33 a násl. zákona č. 262/2006 Sb., zákoník práce, ve znění pozdějších předpisů (dále jen „zákoník práce“). Smluvní strany prohlašují, že smlouvu uzavírají svobodně, vážně, srozumitelně, nikoli v tísni ani za nápadně nevýhodných podmínek.',
    DPP:
      'Smluvní strany uzavírají tuto dohodu o provedení práce podle § 75 a násl. zákoníku práce. Rozsah vykonávané práce nesmí u téhož zaměstnavatele přesáhnout 300 hodin v kalendářním roce. Tato dohoda není pracovní smlouvou ve smyslu § 33 zákoníku práce.',
    DPC:
      'Smluvní strany uzavírají tuto dohodu o pracovní činnosti podle § 76 a násl. zákoníku práce. Rozsah práce nesmí přesáhnout polovinu stanovené týdenní pracovní doby. Smluvní strany sjednávají práci v rozsahu a za podmínek uvedených níže.',
    SMLOUVA_O_DILO:
      'Objednatel a zhotovitel (dále jen „smluvní strany“) uzavírají smlouvu o dílo podle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů (dále jen „občanský zákoník“). Zhotovitel se zavazuje provést dílo a objednatel se zavazuje dílo převzít a zaplatit sjednanou cenu.',
    RAMCOVA_SMLOUVA:
      'Smluvní strany uzavírají rámcovou smlouvu o spolupráci podle občanského zákoníku. Tato smlouva stanoví obecné podmínky spolupráce; konkrétní plnění budou upřesněna objednávkami, dílčími smlouvami nebo předávacími protokoly.',
    OBJEDNAVKA:
      'Objednatel tímto písemně objednává u zhotovitele níže specifikované plnění. Objednávka je závazná dnem potvrzení zhotovitelem, není-li mezi stranami sjednáno jinak.',
    PREDAVACI_PROTOKOL:
      'Smluvní strany potvrzují řádné předání a převzetí díla nebo plnění dle smlouvy, objednávky či jiného smluvního titulu. Tento protokol slouží jako doklad o splnění závazku a předání výsledku.',
    DODATEK:
      'Smluvní strany mění původní smlouvu tímto dodatkem. Nezměněná ustanovení původní smlouvy zůstávají v platnosti beze změny, pokud tento dodatek výslovně nestanoví jinak.',
  }

  return `<section class="doc-section"><p>${intros[type]}</p></section>`
}

export function employmentTermsSection(data: ContractData): string {
  const { supplemental, documentType: contractType, worker } = data
  const workplace = supplemental.workplace || data.order?.location || ''
  const startDate = worker?.start_date ? formatDate(worker.start_date) : ''
  const weeklyHours = supplemental.weekly_hours?.trim() || (contractType === 'HPP' ? '40 hodin týdně' : '')
  const trialPeriod =
    contractType === 'HPP'
      ? supplemental.trial_period?.trim() || '3 měsíce'
      : supplemental.contract_duration?.trim() || supplemental.trial_period?.trim() || 'na dobu určitou'

  const dppLimit =
    contractType === 'DPP'
      ? '<p><strong>Upozornění:</strong> Celkový rozsah práce na základě této dohody nesmí u téhož zaměstnavatele přesáhnout 300 hodin v kalendářním roce.</p>'
      : ''
  const dpcLimit =
    contractType === 'DPC'
      ? '<p><strong>Upozornění:</strong> Rozsah práce nesmí přesáhnout polovinu stanovené týdenní pracovní doby.</p>'
      : ''

  return `
    <section class="doc-section">
      <h2>Článek II. – Druh práce a místo výkonu</h2>
      <p>Zaměstnanec se zavazuje vykonávat pro zaměstnavatele práci na pozici:</p>
      ${kv('Pracovní pozice', worker?.position)}
      ${kv('Místo výkonu práce', workplace)}
      ${kv('Den nástupu do práce', startDate)}
      <p>Zaměstnavatel je povinen přidělovat zaměstnanci práci v souladu s touto smlouvou a platnými právními předpisy.</p>
    </section>
    <section class="doc-section">
      <h2>Článek III. – Mzda a platební podmínky</h2>
      ${kv('Výše mzdy / odměny', supplemental.salary)}
      <p>Mzda je splatná po vykonání práce, a není-li dohodnuto jinak, nejpozději v kalendářním měsíci následujícím po měsíci, ve kterém vznikl zaměstnanci nárok na mzdu nebo odměnu z dohody.</p>
      <p>Zaměstnavatel srazí ze mzdy zákonné srážky a provede zúčtování pojistného na sociální zabezpečení a zdravotní pojištění dle platných předpisů.</p>
    </section>
    <section class="doc-section">
      <h2>Článek IV. – Pracovní doba a doba odpočinku</h2>
      ${kv('Týdenní pracovní doba', weeklyHours)}
      ${contractType === 'HPP' ? kv('Zkušební doba', trialPeriod) : kv('Doba trvání', trialPeriod)}
      ${dppLimit}
      ${dpcLimit}
      <p>Rozvržení pracovní doby, přestávky v práci na jídlo a oddech a doba čerpání dovolené se řídí zákoníkem práce a vnitřními předpisy zaměstnavatele.</p>
    </section>
    <section class="doc-section">
      <h2>Článek V. – Práva a povinnosti smluvních stran</h2>
      <p>Zaměstnanec je povinen vykonávat práci svědomitě podle pokynů zaměstnavce, dodržovat pracovní kázeň, povinnosti vyplývající z právních předpisů a vnitřních předpisů zaměstnavatele, zejména v oblasti bezpečnosti a ochrany zdraví při práci.</p>
      <p>Zaměstnanec se zavazuje zachovávat mlčenlivost o důvěrných informacích zaměstnavatele a zákazníků, které se dozví v souvislosti s výkonem práce.</p>
      <p>Zaměstnavatel je povinen vytvářet podmínky pro řádný výkon práce, dodržovat povinnosti vyplývající z pracovněprávních předpisů a poskytovat zaměstnanci pracovní pomůcky nezbytné k výkonu práce.</p>
    </section>
    <section class="doc-section">
      <h2>Článek VI. – Dovolená a ukončení pracovního poměru</h2>
      <p>Nárok na dovolenou se řídí zákoníkem práce. Pracovní poměr lze ukončit dohodou, výpovědí nebo okamžitým zrušením za podmínek stanovených zákoníkem práce.</p>
    </section>
  `
}

export function businessTermsSection(data: ContractData): string {
  const s = data.supplemental
  const deliveryDate = s.delivery_date ? formatDate(s.delivery_date) : null

  return `
    <section class="doc-section">
      <h2>Článek II. – Předmět plnění</h2>
      ${kv('Předmět', s.subject || data.order?.name)}
      ${kv('Popis / rozsah', s.scope_description)}
      ${kv('Místo plnění', s.delivery_place || data.order?.location)}
      ${kv('Reference smlouvy / zakázky', s.contract_reference || data.order?.contract_number)}
    </section>
    <section class="doc-section">
      <h2>Článek III. – Cena a platební podmínky</h2>
      ${kv('Cena / odměna', s.total_price)}
      ${kv('Platební podmínky', s.payment_terms || 'Fakturace po dokončení a předání plnění, splatnost 14 kalendářních dnů.')}
      ${kv('Termín plnění / dodání', deliveryDate)}
      <p>Cena je sjednána jako cena za kompletní plnění dle specifikace, není-li výslovně uvedeno jinak. Daň z přidané hodnoty bude fakturována dle platných právních předpisů, pokud je zhotovitel plátcem DPH.</p>
    </section>
    <section class="doc-section">
      <h2>Článek IV. – Práva a povinnosti stran</h2>
      <p>Zhotovitel se zavazuje provést dílo odborně, včas a v souladu s obecně závaznými právními předpisy, technickými normami a pokyny objednatele.</p>
      <p>Objednatel se zavazuje poskytnout nezbytnou součinnost, umožnit přístup na místo plnění a uhradit sjednanou cenu po řádném předání a převzetí plnění.</p>
      <p>Vady plnění je objednatel povinen uplatnit bez zbytečného odkladu poté, co je při věnování odborné péče mohl zjistit. Zhotovitel vady v přiměřené lhůtě odstraní nebo poskytne přiměřenou slevu z ceny.</p>
    </section>
  `
}

export function handoverProtocolSection(data: ContractData): string {
  const s = data.supplemental
  return `
    <section class="doc-section">
      <h2>Článek II. – Předmět předání</h2>
      ${kv('Předmět předání', s.subject || data.order?.name)}
      ${kv('Reference smlouvy / objednávky', s.contract_reference || data.order?.contract_number)}
      ${kv('Místo předání', s.delivery_place || data.order?.location)}
      ${kv('Datum předání', s.delivery_date ? formatDate(s.delivery_date) : formatDate(new Date().toISOString().slice(0, 10)))}
      <p>Smluvní strany potvrzují, že předmět plnění byl předán objednateli ke kontrole a převzetí v dohodnutém rozsahu, není-li níže uvedeno jinak.</p>
    </section>
    <section class="doc-section">
      <h2>Článek III. – Prohlášení stran</h2>
      <p>Objednatel prohlašuje, že převzal plnění a nemá námitek k rozsahu a kvalitě, není-li v protokolu uvedeno jinak. Zhotovitel prohlašuje, že plnění bylo provedeno dle smlouvy a objednateli předáno ke dni podpisu tohoto protokolu.</p>
      ${s.scope_description ? `<p><strong>Poznámka:</strong> ${escHtml(s.scope_description)}</p>` : ''}
    </section>
  `
}

export function amendmentSection(data: ContractData): string {
  const s = data.supplemental
  return `
    <section class="doc-section">
      <h2>Článek II. – Předmět dodatku</h2>
      ${kv('Číslo dodatku', s.amendment_number || data.documentNumber)}
      ${kv('Původní smlouva', s.contract_reference || data.order?.contract_number)}
      ${kv('Předmět změny', s.amendment_subject)}
      <p>Tímto dodatkem se mění ustanovení původní smlouvy v rozsahu uvedeném výše. Ostatní ustanovení původní smlouvy zůstávají nedotčena a zůstávají v plné platnosti a účinnosti.</p>
    </section>
  `
}

export function orderReferenceSection(data: ContractData): string {
  if (!data.order) return ''
  return `
    <section class="doc-section">
      <h2>Reference zakázky</h2>
      ${kv('Název zakázky', data.order.name)}
      ${kv('Místo plnění', data.order.location)}
      ${kv('Objednatel / zákazník', data.order.client_name)}
      ${kv('Číslo smlouvy / zakázky', data.order.contract_number)}
    </section>
  `
}

export function additionalTermsSection(supplemental: ContractData['supplemental']): string {
  if (!supplemental.additional_terms.trim()) return ''
  return `
    <section class="doc-section">
      <h2>Další ujednání</h2>
      <p>${escHtml(supplemental.additional_terms).replace(/\n/g, '<br />')}</p>
    </section>
  `
}

export function closingSection(): string {
  return `
    <section class="doc-section">
      <h2>Závěrečná ustanovení</h2>
      <p>Smlouva se uzavírá ve dvou stejnopisech, z nichž obdrží každá smluvní strana po jednom. Smlouva nabývá platnosti a účinnosti dnem podpisu oběma smluvními stranami, není-li výslovně sjednáno jinak.</p>
      <p>Smluvní strany prohlašují, že si smlouvu před podpisem přečetly, že byla uzavřena z jejich svobodné vůle, že její obsahu rozumí a na důkaz toho připojují své podpisy.</p>
      <p>Ve věcech v této smlouvě neupravených se smluvní strany řídí příslušnými ustanoveními zákoníku práce nebo občanského zákoníku a souvisejícími právními předpisy České republiky.</p>
    </section>
  `
}

export function signatureSection(company: ContractAutoCompanyData, worker: ContractAutoWorkerData | null, order: ContractOrderData | null): string {
  const place = company.city || company.address.split(',')[0]?.trim() || '…………'
  const today = formatDate(new Date().toISOString().slice(0, 10))
  const secondName = worker
    ? `${worker.first_name} ${worker.last_name}`
    : order?.client_name || '…………………………'
  const secondRole = worker ? 'Zaměstnanec' : 'Objednatel / Druhá smluvní strana'

  return `
    <section class="doc-section">
      <p>V ${escHtml(place)}, dne ${escHtml(today)}</p>
      <div class="doc-signatures">
        <div class="doc-sign-box">
          <div class="doc-sign-line">${escHtml(company.company_name)}</div>
          <div class="doc-sign-role">${escHtml(company.director_name || 'Jednatel společnosti')}</div>
        </div>
        <div class="doc-sign-box">
          <div class="doc-sign-line">${escHtml(secondName)}</div>
          <div class="doc-sign-role">${escHtml(secondRole)}</div>
        </div>
      </div>
    </section>
  `
}

export function partiesSection(data: ContractData): string {
  const { company, worker, order, documentType } = data
  const isBusiness =
    documentType === 'SMLOUVA_O_DILO' ||
    documentType === 'RAMCOVA_SMLOUVA' ||
    documentType === 'OBJEDNAVKA' ||
    documentType === 'PREDAVACI_PROTOKOL'

  let left = companyPartyBlock(company, isBusiness ? 'Zhotovitel' : 'Zaměstnavatel')
  let right = ''

  if (worker) {
    right = workerPartyBlock(worker)
  } else if (order) {
    right = clientPartyBlock(order)
  } else {
    right =
      '<div class="doc-party"><h3>Druhá smluvní strana</h3><p>Údaje budou doplněny dle smluvního vztahu.</p></div>'
  }

  return `
    <section class="doc-section">
      <h2>Článek I. – Smluvní strany</h2>
      <div class="doc-parties">
        ${left}
        ${right}
      </div>
    </section>
  `
}
