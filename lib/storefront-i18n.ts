// Slice 125 — trilingual seller page: English / Español /
// Kreyòl Ayisyen, one tap. The toggle translates the PLATFORM's
// own UI copy only — headings, buttons, form labels, How It
// Works, the situations checklist, the FAQ, the no-strangers
// promise, and the tracker labels. Anything the wholesaler or
// the seller wrote themselves (bio, offer terms, testimonials,
// the seller's own answers) appears exactly as written, and the
// page says so. Numbers, dates, and prices are never altered by
// the toggle. The privacy/assignment disclosure itself stays in
// English — the toggle adds only a short note that the English
// version governs. These translations are provided for
// convenience; they are not claimed to be perfect or certified.

export type StorefrontLang = 'en' | 'es' | 'ht';

export const STOREFRONT_LANGS: { code: StorefrontLang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'ht', label: 'Kreyòl Ayisyen' },
];

export interface FaqEntry {
  q: string;
  a: string;
}

export interface StorefrontDict {
  tellUs: string;
  step1Note: string;
  step2Note: string;
  namePh: string;
  phonePh: string;
  emailPh: string;
  addressPh: string;
  cityPh: string;
  statePh: string;
  zipPh: string;
  askingPh: string;
  notesPh: string;
  consent: string;
  getOffer: string;
  complete: string;
  back: string;
  thankYou: string;
  receivedMsg: string;
  trackLink: string;
  trackIntro: string;
  bannerSub: string;
  offerTagline: string;
  areasLabel: string;
  weBuyLabel: string;
  callText: string;
  bookCall: string;
  closingAssurance: string;
  closingsHandledBy: string;
  howTitle: string;
  how1Title: string;
  how1Body: string;
  how2Title: string;
  how2Body: string;
  how3Title: string;
  how3Body: string;
  compareTitle: string;
  compareColUs: string;
  compareColAgent: string;
  compareFees: string;
  compareRepairs: string;
  compareClose: string;
  compareCosts: string;
  compareAgentFees: string;
  compareAgentRepairs: string;
  compareAgentClose: string;
  compareAgentCosts: string;
  compareNote: string;
  situationsTitle: string;
  situations: string[];
  trackTitle: string;
  trackNone: string;
  trackSome: string;
  pastDealCity: string;
  pastDealDays: string;
  testimonialsTitle: string;
  faqTitle: string;
  faqs: FaqEntry[];
  noStrangers: string;
  noStrangersTitle: string;
  inheritedToggle: string;
  inheritedTitle: string;
  estateNote: string;
  estateRoleLabel: string;
  estateRoleOptions: string[];
  lettersLabel: string;
  lettersOptions: string[];
  courtLabel: string;
  courtOptions: string[];
  estateNotesPh: string;
  closingDateLabel: string;
  closingDateHint: string;
  photosTitle: string;
  photosHint: string;
  questionsTitle: string;
  roofLabel: string;
  hvacLabel: string;
  reasonLabel: string;
  reasonOptions: string[];
  roofOptions: string[];
  hvacOptions: string[];
  sentPhotoTitle: string;
  typeLabel: string;
  conditionLabel: string;
  occupancyLabel: string;
  timelineLabel: string;
  typeOptions: string[];
  conditionOptions: string[];
  occupancyOptions: string[];
  timelineOptions: string[];
  errNameAddress: string;
  errStep1: string;
  errStep2: string;
  disclosureGoverns: string;
  asWrittenNote: string;
  statusReceived: string;
  statusReviewed: string;
  statusOfferMade: string;
  statusClosing: string;
  statusClosed: string;
  youAreHere: string;
  trackerTitle: string;
  trackerInvalid: string;
  trackerFor: string;
  trackerClosingDate: string;
  trackerPreferredDate: string;
  trackerNoOffer: string;
  receiptTitle: string;
  receiptOffer: string;
  receiptComps: string;
  receiptRepairs: string;
  receiptResale: string;
  receiptAsking: string;
  receiptNote: string;
  receiptNotProvided: string;
  receiptIntro: string;
  sending: string;
  loading: string;
}

const EN: StorefrontDict = {
  tellUs: 'Tell us about your property',
  step1Note: 'Step 1 of 2 — just the basics, and we will reach out with a fair cash offer. Your details go only to this company.',
  step2Note: 'Step 2 of 2 — a few details help price your offer accurately. Your address and contact from step 1 are already saved, so you can close this page any time and we will still reach out.',
  namePh: 'Your full name *',
  phonePh: 'Phone',
  emailPh: 'Email',
  addressPh: 'Property address *',
  cityPh: 'City',
  statePh: 'State',
  zipPh: 'ZIP',
  askingPh: 'Asking price (optional)',
  notesPh: "Anything else we should know? Whatever you're comfortable sharing.",
  consent: "It's OK for this company to call or text me about my property.",
  getOffer: 'Get My Cash Offer',
  complete: 'Complete my request',
  back: 'Back',
  thankYou: 'Thank you',
  receivedMsg: 'received your property details and will reach out shortly. There’s nothing else you need to do.',
  trackLink: 'Track your submission',
  trackIntro: 'See where your sale stands — no account needed. Keep this link private.',
  bannerSub: 'No obligation. No repairs. No cleaning. No realtor commissions. Tell us about your property below — it takes about a minute.',
  offerTagline: 'fast, fair, and free',
  areasLabel: 'Areas we buy in: ',
  weBuyLabel: 'We buy: ',
  callText: 'Call or Text for a Same-Day Offer',
  bookCall: 'Book a 10-min call',
  closingAssurance: 'All purchases close securely through a licensed local Title Company / Real Estate Attorney — never a wire transfer to an individual.',
  closingsHandledBy: 'Closings handled by',
  howTitle: 'How it works',
  how1Title: 'Submit your property',
  how1Body: 'Takes about 60 seconds. No obligation.',
  how2Title: 'Receive a fair cash offer',
  how2Body: 'As fast as we can review it.',
  how3Title: 'Close on your timeline',
  how3Body: 'No realtor commissions. No repair costs.',
  compareTitle: 'Selling to us vs. a traditional agent',
  compareColUs: 'Selling to',
  compareColAgent: 'Traditional listing',
  compareFees: 'Fees / commissions',
  compareRepairs: 'Repairs needed',
  compareClose: 'Time to close',
  compareCosts: 'Closing costs',
  compareAgentFees: 'Agent commission due at closing',
  compareAgentRepairs: 'Often requested by buyers',
  compareAgentClose: 'Often 30–90 days',
  compareAgentCosts: "Usually the seller's cost",
  compareNote: 'These are the company’s own terms, as listed by them — not platform-wide promises.',
  situationsTitle: 'Situations we help with',
  situations: [
    'Behind on Mortgage / Pre-Foreclosure',
    'Inherited / Probate Property',
    'Code Violations / Unpermitted Work',
    'Tired Landlord',
    'Relocating Fast',
  ],
  trackTitle: 'Track record',
  trackNone: 'New on this platform — no closings counted yet. Every closing here gets counted.',
  trackSome: 'deal(s) closed on this platform — counted from closing records, not claimed.',
  pastDealCity: 'Purchased in',
  pastDealDays: 'Closed in',
  testimonialsTitle: 'What sellers told us',
  faqTitle: 'Questions sellers ask us',
  faqs: [
    {
      q: 'Do I have to clean out the house?',
      a: 'No. We buy houses as-is — you can leave whatever you do not want. Take what matters to you; we handle the rest.',
    },
    {
      q: "What if I'm behind on payments or facing foreclosure?",
      a: 'Tell us where things stand and we will move fast to review your property. We buy as-is and can often close in days, but we never promise to stop a foreclosure — only a court can do that, and you should talk to an attorney about your deadlines.',
    },
    {
      q: 'How do you calculate my offer?',
      a: 'We look at what similar homes nearby have sold for, subtract the cost of the repairs the home needs, and subtract a margin for the resale. That gives the most we can fairly pay. There is no fee to get the offer, and you are never obligated to take it.',
    },
    {
      q: 'Are there any fees or commissions?',
      a: 'No. Selling directly means no realtor commission from you, and we buy as-is so there are no repair bills before closing. Your exact terms are listed in the comparison above.',
    },
    {
      q: 'Who do I close with?',
      a: 'Every purchase closes through a licensed local title company or real estate attorney — never a wire transfer to an individual. You always know who you are closing with before you sign anything.',
    },
  ],
  noStrangers: 'Only I visit your home. No open houses, no lockbox, no parade of strangers.',
  noStrangersTitle: 'Our promise to you',
  inheritedToggle: "I'm selling an inherited home",
  inheritedTitle: 'Inherited home — a few estate facts',
  estateNote: 'A sale can be contingent on court approval — we will work with the court’s timeline. This is general information, not legal advice.',
  estateRoleLabel: 'Who is handling the estate?',
  estateRoleOptions: ['Personal representative', 'Trustee', 'Other'],
  lettersLabel: 'Have Letters been issued?',
  lettersOptions: ['Yes', 'No', 'Not yet', 'Not sure'],
  courtLabel: 'Will court approval be needed?',
  courtOptions: ['Yes', 'No', 'Not sure'],
  estateNotesPh: 'Anything about the estate that helps (optional)',
  closingDateLabel: 'Your ideal closing day (optional)',
  closingDateHint: 'Pick the day that works for you — your offer follows this date.',
  photosTitle: 'Photos help your offer — snap up to 5 (roof, kitchen, major damage). They go only to this company’s private file for this property.',
  photosHint: 'Images only, up to 5 MB each, up to 5 photos.',
  questionsTitle: 'A few quick questions (optional) — your answers help price your offer accurately.',
  roofLabel: 'Roof age…',
  hvacLabel: 'Heating & cooling…',
  reasonLabel: 'Reason for selling…',
  reasonOptions: ['Relocating', 'Inherited property', 'Downsizing', 'Behind on payments', 'Tired of landlording', 'Other / prefer not to say'],
  roofOptions: ['Under 10 years old', '10–20 years old', 'Over 20 years / needs work', 'Not sure'],
  hvacOptions: ['Working', 'Needs repair', 'Not working / none', 'Not sure'],
  sentPhotoTitle: 'Optional: photos help {company} understand the property — the outside, any rooms or repairs you want them to see. Images only, up to 6, and they go only to {company}’s private file for this property.',
  typeLabel: 'Property type',
  conditionLabel: 'Property condition',
  occupancyLabel: 'Who lives there now?',
  timelineLabel: 'How soon would you like to sell?',
  typeOptions: ['Single-Family', 'Multi-Family', 'Vacant Land', 'Townhouse / Condo'],
  conditionOptions: ['Needs Major Repairs', 'Cosmetic Work', 'Move-In Ready'],
  occupancyOptions: ['Owner-Occupied', 'Tenant', 'Vacant'],
  timelineOptions: ['ASAP', '30 Days', 'Just Exploring'],
  errNameAddress: 'Please add your name and the property address.',
  errStep1: 'Your details could not be sent. Check the address and name, then try again.',
  errStep2: 'Your details could not be finished — but your address and contact from step 1 are saved, and we will still reach out.',
  disclosureGoverns: 'The English version of this disclosure governs.',
  asWrittenNote: 'Details the seller or the company wrote appear exactly as written.',
  statusReceived: 'Received',
  statusReviewed: 'Reviewed',
  statusOfferMade: 'Offer made',
  statusClosing: 'Closing',
  statusClosed: 'Closed',
  youAreHere: 'you are here',
  trackerTitle: 'Where your sale stands',
  trackerInvalid: 'This tracking link isn’t valid. Check the link and try again.',
  trackerFor: 'Your submission for',
  trackerClosingDate: 'Closing date',
  trackerPreferredDate: 'The closing day you picked',
  trackerNoOffer: 'No offer yet — we will show it here as soon as one is made.',
  receiptTitle: 'How your offer was built',
  receiptOffer: 'Your offer',
  receiptComps: 'Comparable sales',
  receiptRepairs: 'Repairs needed',
  receiptResale: 'Resale costs',
  receiptAsking: 'Your asking price',
  receiptNote: 'Note from the buyer',
  receiptNotProvided: 'Not provided',
  receiptIntro: 'Every number below is what the buyer entered from your property and the county record — nothing is guessed.',
  sending: 'Sending…',
  loading: 'Loading…',
};

const ES: StorefrontDict = {
  tellUs: 'Cuéntenos sobre su propiedad',
  step1Note: 'Paso 1 de 2 — solo lo básico, y nos comunicaremos con una oferta justa en efectivo. Sus datos van solo a esta empresa.',
  step2Note: 'Paso 2 de 2 — algunos detalles ayudan a calcular su oferta con precisión. Su dirección y contacto del paso 1 ya están guardados, así que puede cerrar esta página cuando quiera y aun así nos comunicaremos.',
  namePh: 'Su nombre completo *',
  phonePh: 'Teléfono',
  emailPh: 'Correo electrónico',
  addressPh: 'Dirección de la propiedad *',
  cityPh: 'Ciudad',
  statePh: 'Estado',
  zipPh: 'Código postal',
  askingPh: 'Precio que pide (opcional)',
  notesPh: '¿Algo más que debamos saber? Lo que usted quiera compartir.',
  consent: 'Está bien que esta empresa me llame o me escriba sobre mi propiedad.',
  getOffer: 'Obtener mi oferta en efectivo',
  complete: 'Completar mi solicitud',
  back: 'Atrás',
  thankYou: 'Gracias',
  receivedMsg: 'recibió los datos de su propiedad y se comunicará pronto. No necesita hacer nada más.',
  trackLink: 'Seguir mi solicitud',
  trackIntro: 'Vea en qué punto está su venta — no necesita cuenta. Mantenga este enlace privado.',
  bannerSub: 'Sin obligación. Sin reparaciones. Sin limpieza. Sin comisiones de agente. Cuéntenos sobre su propiedad abajo — toma alrededor de un minuto.',
  offerTagline: 'rápido, justo y gratis',
  areasLabel: 'Áreas donde compramos: ',
  weBuyLabel: 'Compramos: ',
  callText: 'Llame o escriba para una oferta el mismo día',
  bookCall: 'Reservar una llamada de 10 min',
  closingAssurance: 'Todas las compras cierran de forma segura a través de una compañía de título local con licencia o un abogado de bienes raíces — nunca una transferencia a una persona.',
  closingsHandledBy: 'Cierres a cargo de',
  howTitle: 'Cómo funciona',
  how1Title: 'Envíe su propiedad',
  how1Body: 'Tarda unos 60 segundos. Sin obligación.',
  how2Title: 'Reciba una oferta justa en efectivo',
  how2Body: 'Tan rápido como podamos revisarla.',
  how3Title: 'Cierre en su fecha',
  how3Body: 'Sin comisiones de agente. Sin costos de reparación.',
  compareTitle: 'Vender a nosotros vs. un agente tradicional',
  compareColUs: 'Vender a',
  compareColAgent: 'Venta tradicional',
  compareFees: 'Cargos / comisiones',
  compareRepairs: 'Reparaciones necesarias',
  compareClose: 'Tiempo para cerrar',
  compareCosts: 'Costos de cierre',
  compareAgentFees: 'Comisión del agente al cierre',
  compareAgentRepairs: 'A menudo las piden los compradores',
  compareAgentClose: 'A menudo 30–90 días',
  compareAgentCosts: 'Por lo general, a cargo del vendedor',
  compareNote: 'Estos son los términos propios de la empresa, según los publicó ella — no son promesas de la plataforma.',
  situationsTitle: 'Situaciones con las que ayudamos',
  situations: [
    'Atrasado en la hipoteca / Pre-ejecución hipotecaria',
    'Propiedad heredada / Sucesión',
    'Violaciones de código / Trabajo sin permiso',
    'Propietario cansado',
    'Mudanza rápida',
  ],
  trackTitle: 'Historial',
  trackNone: 'Nuevo en esta plataforma — aún no hay cierres contados. Cada cierre aquí se cuenta.',
  trackSome: 'venta(s) cerrada(s) en esta plataforma — contadas de los registros de cierre, no afirmadas.',
  pastDealCity: 'Comprada en',
  pastDealDays: 'Cerrada en',
  testimonialsTitle: 'Lo que nos dijeron los vendedores',
  faqTitle: 'Preguntas que nos hacen los vendedores',
  faqs: [
    {
      q: '¿Tengo que vaciar la casa?',
      a: 'No. Compramos las casas tal como están — puede dejar lo que no quiera. Lleve lo que le importa; nosotros nos encargamos del resto.',
    },
    {
      q: '¿Qué pasa si estoy atrasado en los pagos o enfrento una ejecución hipotecaria?',
      a: 'Díganos cómo están las cosas y nos moveremos rápido para revisar su propiedad. Compramos tal como está y a menudo podemos cerrar en días, pero nunca prometemos detener una ejecución hipotecaria — solo un tribunal puede hacerlo, y usted debe hablar con un abogado sobre sus fechas límite.',
    },
    {
      q: '¿Cómo calculan mi oferta?',
      a: 'Miramos lo que han vendido casas similares cercanas, restamos el costo de las reparaciones que necesita la casa y restamos un margen para la reventa. Eso da lo máximo que podemos pagar de forma justa. No hay cargo por recibir la oferta, y usted nunca está obligado a aceptarla.',
    },
    {
      q: '¿Hay cargos o comisiones?',
      a: 'No. Vender directamente significa que usted no paga comisión de agente, y compramos tal como está, así que no hay facturas de reparación antes del cierre. Sus términos exactos están en la comparación de arriba.',
    },
    {
      q: '¿Con quién cierro?',
      a: 'Cada compra cierra a través de una compañía de título local con licencia o un abogado de bienes raíces — nunca una transferencia a una persona. Usted siempre sabe con quién está cerrando antes de firmar nada.',
    },
  ],
  noStrangers: 'Solo yo visito su casa. Sin puertas abiertas, sin caja de llaves, sin desfile de extraños.',
  noStrangersTitle: 'Nuestra promesa para usted',
  inheritedToggle: 'Estoy vendiendo una casa heredada',
  inheritedTitle: 'Casa heredada — algunos datos de la sucesión',
  estateNote: 'Una venta puede depender de la aprobación del tribunal — trabajaremos con el calendario del tribunal. Esto es información general, no asesoría legal.',
  estateRoleLabel: '¿Quién maneja la sucesión?',
  estateRoleOptions: ['Representante personal', 'Fideicomisario', 'Otro'],
  lettersLabel: '¿Ya se emitieron las Cartas?',
  lettersOptions: ['Sí', 'No', 'Aún no', 'No estoy seguro'],
  courtLabel: '¿Se necesitará aprobación del tribunal?',
  courtOptions: ['Sí', 'No', 'No estoy seguro'],
  estateNotesPh: 'Algo sobre la sucesión que ayude (opcional)',
  closingDateLabel: 'Su día ideal de cierre (opcional)',
  closingDateHint: 'Elija el día que le convenga — su oferta sigue esa fecha.',
  photosTitle: 'Las fotos ayudan a su oferta — tome hasta 5 (techo, cocina, daños mayores). Van solo al archivo privado de esta empresa para esta propiedad.',
  photosHint: 'Solo imágenes, hasta 5 MB cada una, hasta 5 fotos.',
  questionsTitle: 'Algunas preguntas rápidas (opcional) — sus respuestas ayudan a calcular su oferta con precisión.',
  roofLabel: 'Edad del techo…',
  hvacLabel: 'Calefacción y aire…',
  reasonLabel: 'Motivo de la venta…',
  reasonOptions: ['Mudanza', 'Propiedad heredada', 'Reducción de tamaño', 'Atrasado en pagos', 'Cansado de ser propietario', 'Otro / prefiero no decirlo'],
  roofOptions: ['Menos de 10 años', '10–20 años', 'Más de 20 años / necesita trabajo', 'No estoy seguro'],
  hvacOptions: ['Funciona', 'Necesita reparación', 'No funciona / ninguno', 'No estoy seguro'],
  sentPhotoTitle: 'Opcional: las fotos ayudan a {company} a entender la propiedad — el exterior, cualquier habitación o reparación que quiera mostrarles. Solo imágenes, hasta 6, y van solo al archivo privado de {company} para esta propiedad.',
  typeLabel: 'Tipo de propiedad',
  conditionLabel: 'Condición de la propiedad',
  occupancyLabel: '¿Quién vive allí ahora?',
  timelineLabel: '¿Qué tan pronto quiere vender?',
  typeOptions: ['Unifamiliar', 'Multifamiliar', 'Terreno baldío', 'Casa adosada / Condominio'],
  conditionOptions: ['Necesita reparaciones mayores', 'Trabajo cosmético', 'Lista para mudarse'],
  occupancyOptions: ['Ocupada por el dueño', 'Inquilino', 'Vacía'],
  timelineOptions: ['Lo antes posible', '30 días', 'Solo explorando'],
  errNameAddress: 'Por favor agregue su nombre y la dirección de la propiedad.',
  errStep1: 'No se pudieron enviar sus datos. Revise la dirección y el nombre, e intente de nuevo.',
  errStep2: 'No se pudieron completar sus datos — pero su dirección y contacto del paso 1 están guardados, y aun así nos comunicaremos.',
  disclosureGoverns: 'La versión en inglés de este aviso es la que rige.',
  asWrittenNote: 'Los detalles escritos por el vendedor o la empresa aparecen exactamente como fueron escritos.',
  statusReceived: 'Recibido',
  statusReviewed: 'Revisado',
  statusOfferMade: 'Oferta hecha',
  statusClosing: 'Cierre',
  statusClosed: 'Cerrado',
  youAreHere: 'usted está aquí',
  trackerTitle: 'En qué punto está su venta',
  trackerInvalid: 'Este enlace de seguimiento no es válido. Revise el enlace e intente de nuevo.',
  trackerFor: 'Su solicitud para',
  trackerClosingDate: 'Fecha de cierre',
  trackerPreferredDate: 'El día de cierre que usted eligió',
  trackerNoOffer: 'Aún no hay oferta — la mostraremos aquí tan pronto como se haga una.',
  receiptTitle: 'Cómo se calculó su oferta',
  receiptOffer: 'Su oferta',
  receiptComps: 'Ventas comparables',
  receiptRepairs: 'Reparaciones necesarias',
  receiptResale: 'Costos de reventa',
  receiptAsking: 'Su precio pedido',
  receiptNote: 'Nota del comprador',
  receiptNotProvided: 'No proporcionado',
  receiptIntro: 'Cada número abajo es lo que el comprador anotó de su propiedad y del registro del condado — nada es adivinado.',
  sending: 'Enviando…',
  loading: 'Cargando…',
};

const HT: StorefrontDict = {
  tellUs: 'Di nou sou pwopriyete w la',
  step1Note: 'Etap 1 sou 2 — sèlman enfòmasyon debaz yo, epi n ap kontakte w ak yon òf lajan kach ki jis. Enfòmasyon ou yo ale sèlman bay konpayi sa a.',
  step2Note: 'Etap 2 sou 2 — kèk detay ede kalkile òf ou a byen. Adrès ou ak kontak ou nan etap 1 an deja anrejistre, kidonk ou ka fèmen paj sa a nenpòt lè epi n ap toujou kontakte w.',
  namePh: 'Non konplè ou *',
  phonePh: 'Telefòn',
  emailPh: 'Imèl',
  addressPh: 'Adrès pwopriyete a *',
  cityPh: 'Vil',
  statePh: 'Eta',
  zipPh: 'Kòd postal',
  askingPh: 'Pri w ap mande (si ou vle)',
  notesPh: 'Gen yon lòt bagay nou ta dwe konnen? Di sa ou vle pataje.',
  consent: 'Li oke pou konpayi sa a rele oswa ekri m sou pwopriyete m nan.',
  getOffer: 'Pran òf lajan kach mwen',
  complete: 'Fini demann mwen',
  back: 'Retou',
  thankYou: 'Mèsi',
  receivedMsg: 'te resevwa detay pwopriyete w la epi l ap kontakte w byento. Ou pa bezwen fè anyen ankò.',
  trackLink: 'Swiv demann mwen',
  trackIntro: 'Wè ki kote vant ou ye — ou pa bezwen kont. Kenbe lyen sa a prive.',
  bannerSub: 'Pa gen obligasyon. Pa gen reparasyon. Pa gen netwayaj. Pa gen komisyon ajan. Di nou sou pwopriyete w anba a — li pran apepre yon minit.',
  offerTagline: 'vit, jis, epi gratis',
  areasLabel: 'Zòn nou achte yo: ',
  weBuyLabel: 'Nou achte: ',
  callText: 'Rele oswa ekri pou yon òf menm jou a',
  bookCall: 'Rezève yon apèl 10 minit',
  closingAssurance: 'Tout acha fèmen an sekirite atravè yon konpayi tit lokal ki gen lisans oswa yon avoka byen imobilye — pa janm yon transfè bay yon moun.',
  closingsHandledBy: 'Fèmti yo okipe pa',
  howTitle: 'Kijan li mache',
  how1Title: 'Voye pwopriyete w la',
  how1Body: 'Li pran apepre 60 segonn. Pa gen obligasyon.',
  how2Title: 'Resevwa yon òf lajan kach ki jis',
  how2Body: 'Osi vit ke nou ka revize li.',
  how3Title: 'Fèmen nan dat ou chwazi a',
  how3Body: 'Pa gen komisyon ajan. Pa gen pri reparasyon.',
  compareTitle: 'Vann bay nou vs. yon ajan tradisyonèl',
  compareColUs: 'Vann bay',
  compareColAgent: 'Vant tradisyonèl',
  compareFees: 'Frè / komisyon',
  compareRepairs: 'Reparasyon ki nesesè',
  compareClose: 'Tan pou fèmen',
  compareCosts: 'Pri fèmti',
  compareAgentFees: 'Komisyon ajan an nan fèmti a',
  compareAgentRepairs: 'Achtè yo souvan mande yo',
  compareAgentClose: 'Souvan 30–90 jou',
  compareAgentCosts: 'Anjeneral vandè a peye li',
  compareNote: 'Sa yo se kondisyon konpayi an menm, jan li te ekri yo — yo pa pwomès platfòm nan.',
  situationsTitle: 'Sitiyasyon nou ede ak yo',
  situations: [
    'An reta nan ipotèk / Pre-foreklozi',
    'Pwopriyete eritye / Pwobat',
    'Vyolasyon kòd / Travay san pèmi',
    'Pwopriyetè ki fatige',
    'Demenaje vit',
  ],
  trackTitle: 'Istwa',
  trackNone: 'Nouvo sou platfòm sa a — poko gen fèmti ki konte. Chak fèmti isit la konte.',
  trackSome: 'fèmti ki fèt sou platfòm sa a — yo konte apati dosye fèmti yo, yo pa envante.',
  pastDealCity: 'Achte nan',
  pastDealDays: 'Fèmen nan',
  testimonialsTitle: 'Sa vandè yo te di nou',
  faqTitle: 'Kesyon vandè yo poze nou',
  faqs: [
    {
      q: 'Èske mwen dwe vide kay la?',
      a: 'Non. Nou achte kay yo jan yo ye — ou ka kite sa ou pa vle. Pran sa ki enpòtan pou ou; n ap okipe rès la.',
    },
    {
      q: 'Kisa k ap pase si mwen an reta nan peman oswa mwen nan foreklozi?',
      a: 'Di nou ki kote bagay yo ye epi n ap deplase vit pou revize pwopriyete w la. Nou achte jan li ye epi nou ka souvan fèmen nan kèk jou, men nou pa janm pwomèt pou kanpe yon foreklozi — sèlman yon tribinal ka fè sa, epi ou ta dwe pale ak yon avoka sou dat limit ou yo.',
    },
    {
      q: 'Kijan nou kalkile òf la?',
      a: 'Nou gade sa kay menm jan yo toupre yo te vann, nou retire pri reparasyon kay la bezwen, epi nou retire yon maj pou revant lan. Sa bay pi gwo pri nou ka peye yon fason jis. Pa gen frè pou resevwa òf la, epi ou pa janm oblije aksepte li.',
    },
    {
      q: 'Èske gen frè oswa komisyon?',
      a: 'Non. Vann dirèk vle di ou pa peye komisyon ajan, epi nou achte jan li ye kidonk pa gen fakti reparasyon anvan fèmti a. Kondisyon egzak ou yo nan konparezon ki anwo a.',
    },
    {
      q: 'Avèk ki moun mwen fèmen?',
      a: 'Chak acha fèmen atravè yon konpayi tit lokal ki gen lisans oswa yon avoka byen imobilye — pa janm yon transfè bay yon moun. Ou toujou konnen avèk ki moun w ap fèmen anvan ou siyen anyen.',
    },
  ],
  noStrangers: 'Se mwen sèlman ki vizite kay ou. Pa gen pòt louvri, pa gen bwat kle, pa gen yon pakèt moun etranje.',
  noStrangersTitle: 'Pwomès nou pou ou',
  inheritedToggle: 'M ap vann yon kay eritye',
  inheritedTitle: 'Kay eritye — kèk enfòmasyon sou byen yo',
  estateNote: 'Yon vant ka depann de apwobasyon tribinal la — n ap travay ak orè tribinal la. Sa a se enfòmasyon jeneral, pa konsèy legal.',
  estateRoleLabel: 'Ki moun k ap okipe byen yo?',
  estateRoleOptions: ['Reprezantan pèsonèl', 'Fidyè', 'Lòt'],
  lettersLabel: 'Èske yo te bay Lèt yo?',
  lettersOptions: ['Wi', 'Non', 'Poko', 'Mwen pa sèten'],
  courtLabel: 'Èske apwobasyon tribinal la ap nesesè?',
  courtOptions: ['Wi', 'Non', 'Mwen pa sèten'],
  estateNotesPh: 'Yon bagay sou byen yo ki ka ede (si ou vle)',
  closingDateLabel: 'Jou fèmti ideyal ou (si ou vle)',
  closingDateHint: 'Chwazi jou ki bon pou ou — òf ou a swiv dat sa a.',
  photosTitle: 'Foto yo ede òf ou a — pran jiska 5 (twati, kwizin, gwo domaj). Yo ale sèlman nan dosye prive konpayi sa a pou pwopriyete sa a.',
  photosHint: 'Imaj sèlman, jiska 5 MB chak, jiska 5 foto.',
  questionsTitle: 'Kèk kesyon rapid (si ou vle) — repons ou yo ede kalkile òf ou a byen.',
  roofLabel: 'Laj twati a…',
  hvacLabel: 'Chofaj ak klimatizasyon…',
  reasonLabel: 'Rezon vant lan…',
  reasonOptions: ['Demenaje', 'Pwopriyete eritye', 'Diminye', 'An reta nan peman', 'Fatige ak lokasyon', 'Lòt / mwen prefere pa di'],
  roofOptions: ['Mwens pase 10 an', '10–20 an', 'Plis pase 20 an / bezwen travay', 'Mwen pa sèten'],
  hvacOptions: ['L ap mache', 'Li bezwen reparasyon', 'Li pa mache / pa genyen', 'Mwen pa sèten'],
  sentPhotoTitle: 'Si ou vle: foto yo ede {company} konprann pwopriyete a — deyò a, nenpòt chanm oswa reparasyon ou vle yo wè. Imaj sèlman, jiska 6, epi yo ale sèlman nan dosye prive {company} pou pwopriyete sa a.',
  typeLabel: 'Kalite pwopriyete',
  conditionLabel: 'Kondisyon pwopriyete a',
  occupancyLabel: 'Ki moun ki rete la kounye a?',
  timelineLabel: 'Nan konbyen tan ou ta renmen vann?',
  typeOptions: ['Kay yon fanmi', 'Kay plizyè fanmi', 'Tè vid', 'Kay kole / Kondominyòm'],
  conditionOptions: ['Bezwen gwo reparasyon', 'Travay kosmetik', 'Pare pou rete'],
  occupancyOptions: ['Pwopriyetè a rete ladan l', 'Lokatè', 'Vid'],
  timelineOptions: ['Pi vit posib', '30 jou', 'M ap chèche sèlman'],
  errNameAddress: 'Tanpri mete non ou ak adrès pwopriyete a.',
  errStep1: 'Enfòmasyon ou yo pa t ka voye. Tcheke adrès la ak non an, epi eseye ankò.',
  errStep2: 'Detay ou yo pa t ka fini — men adrès ou ak kontak ou nan etap 1 an anrejistre, epi n ap toujou kontakte w.',
  disclosureGoverns: 'Vèsyon anglè avi sa a se li ki gen valè legal.',
  asWrittenNote: 'Detay vandè a oswa konpayi an te ekri parèt egzakteman jan yo te ekri yo.',
  statusReceived: 'Resevwa',
  statusReviewed: 'Revize',
  statusOfferMade: 'Òf fèt',
  statusClosing: 'Fèmti',
  statusClosed: 'Fèmen',
  youAreHere: 'ou isit la',
  trackerTitle: 'Ki kote vant ou ye',
  trackerInvalid: 'Lyen swivi sa a pa valab. Tcheke lyen an epi eseye ankò.',
  trackerFor: 'Demann ou pou',
  trackerClosingDate: 'Dat fèmti',
  trackerPreferredDate: 'Jou fèmti ou te chwazi a',
  trackerNoOffer: 'Poko gen òf — n ap montre li isit la le pli vit ke yo fè yon òf.',
  receiptTitle: 'Kijan òf ou a te kalkile',
  receiptOffer: 'Òf ou a',
  receiptComps: 'Vant konparab',
  receiptRepairs: 'Reparasyon ki nesesè',
  receiptResale: 'Pri revant',
  receiptAsking: 'Pri w ap mande',
  receiptNote: 'Nòt achtè a',
  receiptNotProvided: 'Pa bay',
  receiptIntro: 'Chak nimewo anba a se sa achtè a te ekri apati pwopriyete w la ak dosye konte a — anyen pa devinen.',
  sending: 'N ap voye…',
  loading: 'N ap chaje…',
};

export const STOREFRONT_DICTS: Record<StorefrontLang, StorefrontDict> = {
  en: EN,
  es: ES,
  ht: HT,
};

export function getStorefrontDict(lang: StorefrontLang): StorefrontDict {
  return STOREFRONT_DICTS[lang] || EN;
}

// The no-strangers promise, in English, as the wholesaler opts
// into it. The default text is translated by the toggle; if the
// wholesaler edited the wording, their own words show as written.
export const DEFAULT_NO_STRANGERS =
  'Only I visit your home. No open houses, no lockbox, no parade of strangers.';

export function noStrangersText(profileText: string | undefined | null, lang: StorefrontLang): string {
  const stored = (profileText || '').trim();
  if (!stored || stored === DEFAULT_NO_STRANGERS) return getStorefrontDict(lang).noStrangers;
  return stored;
}
