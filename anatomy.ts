import translationsData from './anatomy-translations.json';

const ALL_TRANSLATIONS: Record<string, string> = translationsData as Record<string, string>;

// Case-insensitive lookup map for maximum coverage
const LOWER_TRANSLATIONS: Map<string, string> = new Map();
for (const [key, value] of Object.entries(ALL_TRANSLATIONS)) {
  LOWER_TRANSLATIONS.set(key.toLowerCase().trim(), value);
}

export type SystemId = 'skeletal'|'muscular'|'arterial'|'venous'|'nervous'|'digestive'|'respiratory'|'urinary'|'reproductive'|'lymphatic'|'endocrine'|'integumentary'|'connective'|'sensory'|'cardiac';

export interface SystemMeta {
  id: SystemId;
  name: string;
  color: string;
  description: string;
}

export const SYSTEMS: SystemMeta[] = [
  {
    id: 'cardiac',
    name: 'Coração',
    color: '#A43939', // ApexMed Medical Crimson
    description: 'Bomba muscular oca localizada no mediastino médio. O aparelho valvar direciona o fluxo sanguíneo unidirecional através das circulações pulmonar e sistêmica de alta pressão.'
  },
  {
    id: 'skeletal',
    name: 'Esqueleto',
    color: '#e2d9ba',
    description: 'Arcabouço osteocartilaginoso de sustentação do corpo. Protege vísceras nobres, serve de alavanca para os músculos e abriga a medula óssea hematopoética.'
  },
  {
    id: 'muscular',
    name: 'Músculos',
    color: '#c06b60',
    description: 'Músculos esqueléticos que geram força contrátil e movimento voluntário. Junto às fáscias e tendões, estabilizam articulações e mantêm a postura ereta.'
  },
  {
    id: 'arterial',
    name: 'Artérias',
    color: '#dc2626',
    description: 'Rede vascular arterial de alta pressão. Distribui sangue oxigenado e nutrientes do ventrículo esquerdo até o leito capilar periférico de todos os órgãos.'
  },
  {
    id: 'venous',
    name: 'Veias',
    color: '#527c9f',
    description: 'Sistema de capacitância que conduz o sangue desoxigenado de volta ao átrio direito. Contém válvulas que evitam o refluxo gravitacional nos membros inferiores.'
  },
  {
    id: 'nervous',
    name: 'Sistema Nervoso',
    color: '#d8b565',
    description: 'Encéfalo, medula espinhal e nervos periféricos. Integra vias aferentes sensoriais, planeja funções executivas motoras e modula a homeostase autonômica.'
  },
  {
    id: 'respiratory',
    name: 'Sistema Respiratório',
    color: '#b98991',
    description: 'Vias aéreas condutoras e parênquima pulmonar. Promove a hematose nos alvéolos e participa da regulação do equilíbrio ácido-base sistêmico.'
  },
  {
    id: 'digestive',
    name: 'Sistema Digestório',
    color: '#b8916b',
    description: 'Tubo gastrintestinal e glândulas anexas (fígado e pâncreas). Responsável por motilidade, digestão química, absorção de micronutrientes e excreção biliar.'
  },
  {
    id: 'urinary',
    name: 'Sistema Urinário',
    color: '#b47961',
    description: 'Rins, ureteres, bexiga e uretra. Filtra o sangue, excreta metabólitos nitrogenados e controla a osmolalidade, volemia e pressão arterial.'
  },
  {
    id: 'lymphatic',
    name: 'Sistema Linfático',
    color: '#879f7c',
    description: 'Vasos linfáticos, linfonodos e baço. Drena o fluido intersticial excedente para o sistema venoso e funciona como sítio de ativação imunitária adaptativa.'
  },
  {
    id: 'endocrine',
    name: 'Sistema Endócrino',
    color: '#c5a09a',
    description: 'Glândulas endócrinas que sintetizam hormônios transportados pela corrente sanguínea, coordenando metabolismo energético, resposta ao estresse e homeostase.'
  },
  {
    id: 'sensory',
    name: 'Órgãos dos Sentidos',
    color: '#b0c8ce',
    description: 'Estruturas sensoriais dedicadas à visão, audição, equilíbrio e olfato. Traduzem estímulos ambientais em potenciais de ação neuronais.'
  },
  {
    id: 'reproductive',
    name: 'Sistema Reprodutor',
    color: '#bda098',
    description: 'Estruturas reprodutivas masculinas envolvidas na espermatogênese, produção de líquido seminal e síntese de hormônios androgênicos como a testosterona.'
  },
  {
    id: 'connective',
    name: 'Tecido Conjuntivo',
    color: '#aec3bb',
    description: 'Fáscias, ligamentos e cartilagens articulares. Amortecem impactos, distribuem cargas mecânicas e mantêm a continuidade estrutural dos compartimentos.'
  },
  {
    id: 'integumentary',
    name: 'Superfície Corporal',
    color: '#ba9b7d',
    description: 'Pele e tecido subcutâneo. Barreira física contra patógenos e perda hídrica, com funções essenciais de termorregulação e sensibilidade somatossensorial.'
  },
];

export interface Part {
  id: string;
  name: string;
  conceptId: string;
  system: SystemId;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number[], number[]];
}

export interface Concept {
  id: string;
  name: string;
  elements: string[];
}

export interface Atlas {
  version: string;
  sex?: 'male';
  source?: string;
  scope?: string;
  parts: Part[];
  concepts: Concept[];
  chunks: { url: string; bytes: number; gzip?: string; gzipBytes?: number }[];
  triangles: number;
}

export type View = 'three-quarter'|'front'|'back'|'side';

export interface SceneState {
  inspectorOpen?: boolean;
  showLandmarks?: boolean;
  explode: number;
  visible: SystemId[];
  selected: string[];
  hiddenParts?: string[];
  isolate: boolean;
  isolateMode?: 'solo' | 'ghost';
  view: View;
  rotate: boolean;
  reset: number;
}

export const DEFAULT_VISIBLE: SystemId[] = [
  'cardiac',
  'sensory',
  'skeletal',
  'muscular',
  'arterial',
  'venous',
  'nervous',
  'respiratory',
  'digestive',
  'urinary',
  'lymphatic',
  'endocrine',
  'reproductive',
  'connective'
];

export interface EducationalGuide {
  domain: string;
  functionalRole: string;
  neurobiologyPsychophysiology: string;
  topographicalRelations: string;
  clinicalSemiology: string;
}

export interface StudyPathway {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  iconName: string;
  targetSystems: SystemId[];
  keyConceptNames: string[];
}

export const STUDY_PATHWAYS: StudyPathway[] = [
  {
    id: 'neuro-psych',
    title: 'Eixo Neuropsicológico & Sistema Nervoso',
    subtitle: 'Encéfalo, Tronco, Medula e Nervo Vago',
    description: 'Estudo das estruturas responsáveis pela regulação emocional, processamento cognitivo, sistema límbico e modulação autonômica do estresse.',
    iconName: 'Brain',
    targetSystems: ['nervous', 'sensory'],
    keyConceptNames: ['brain', 'spinal cord', 'optic nerve', 'vagus nerve']
  },
  {
    id: 'cardio-autonomic',
    title: 'Eixo Cardiorrespiratório & Tônus Vagal',
    subtitle: 'Coração, Miocárdio, Grandes Vasos e Diafragma',
    description: 'Compreensão da dinâmica hemodinâmica, mecânica respiratória diafragmática, barorreflexo e equilíbrio entre tônus simpático e parassimpático.',
    iconName: 'Heart',
    targetSystems: ['cardiac', 'arterial', 'venous', 'respiratory'],
    keyConceptNames: ['heart', 'aorta', 'lung', 'diaphragm', 'trachea']
  },
  {
    id: 'brain-gut-visceral',
    title: 'Eixo Cérebro-Intestino & Homeostase',
    subtitle: 'Trato Digestório, Fígado, Pâncreas e Rins',
    description: 'Conexões do sistema nervoso entérico, sinalização serotoninérgica visceral, metabolismo intermediário e resposta neuroendócrina.',
    iconName: 'Activity',
    targetSystems: ['digestive', 'urinary', 'endocrine'],
    keyConceptNames: ['stomach', 'liver', 'pancreas', 'kidney', 'spleen']
  },
  {
    id: 'locomotor-somatic',
    title: 'Aparelho Locomotor & Tônus Postural',
    subtitle: 'Arcabouço Ósseo, Músculos Voluntários e Fáscias',
    description: 'Biomecânica de sustentação, transmissão de cargas mecânicas, cadeias miofasciais e manifestações somáticas do estresse físico e postural.',
    iconName: 'Focus',
    targetSystems: ['skeletal', 'muscular', 'connective'],
    keyConceptNames: ['femur', 'deltoid', 'pectoralis major', 'latissimus dorsi', 'rectus abdominis']
  }
];

export const PEDAGOGICAL_DATABASE: Record<string, EducationalGuide> = {
  'heart': {
    domain: 'Cardiologia & Fisiologia Autonômica',
    functionalRole: 'Bomba muscular tetra-cavitária que assegura a perfusão tecidual contínua através dos circuitos sistêmico e pulmonar.',
    neurobiologyPsychophysiology: 'Inervado pelo plexo cardíaco (fibras simpáticas de T1-T4 e parassimpáticas pelo Nervo Vago - NC X). A modulação vagal é o principal determinante da Variabilidade da Frequência Cardíaca (VFC), biomarcador direto de flexibilidade autonômica e regulação emocional.',
    topographicalRelations: 'Situado no mediastino médio, repousa sobre o centro tendíneo do diafragma, delimitado lateralmente pelos pulmões e pleuras, e posteriormente pelo esôfago e aorta torácica.',
    clinicalSemiology: 'Ausculta dos focos aórtico, pulmonar, tricúspide e mitral (ictus cordis no 5º EIE na linha hemiclavicular esquerda).'
  },
  'brain': {
    domain: 'Neuroanatomia, Psicologia Cognitiva & Neurologia',
    functionalRole: 'Centro integrador do sistema nervoso central, responsável pela cognição, homeostase, linguagem, memória e regulação motora.',
    neurobiologyPsychophysiology: 'O córtex pré-frontal coordena funções executivas e modula o sistema límbico (amígdala, hipocampo). O eixo Hipotálamo-Hipófise-Adrenal (HPA) orquestra a resposta fisiológica ao estresse agudo e crônico.',
    topographicalRelations: 'Alojado na cavidade craniana, protegido pelas meninges (dura-máter, aracnóide e pia-máter) e banhado pelo líquido cefalorraquidiano nos ventrículos e espaço subaracnóideo.',
    clinicalSemiology: 'Avaliação de pares cranianos, reflexos pupilares e motores, marcha e funções cognitivas superiores.'
  },
  'stomach': {
    domain: 'Gastroenterologia & Eixo Cérebro-Intestino',
    functionalRole: 'Reservatório e câmara de digestão química e mecânica do bolo alimentar através de ácido clorídrico e pepsina.',
    neurobiologyPsychophysiology: 'Comunicação bidirecional direta com o SNC através do nervo vago e do Sistema Nervoso Entérico (plexos mioentérico de Auerbach e submucoso de Meissner). O estresse crônico modula a barreira mucosa gástrica e a motilidade.',
    topographicalRelations: 'Ocupa o hipocôndrio esquerdo e epigástrio. Face anterior relaciona-se com o lobo esquerdo do fígado e parede abdominal; face posterior com a bolsa omental e o pâncreas.',
    clinicalSemiology: 'Palpação de ponto epigástrico, percussão do espaço semilunar de Traube (timpanismo gástrico normal).'
  },
  'liver': {
    domain: 'Hepatologia, Metabolismo & Bioquímica',
    functionalRole: 'Maior glândula do corpo humano, responsável pela depuração metabólica, síntese proteica (albumina e fatores de coagulação) e secreção biliar.',
    neurobiologyPsychophysiology: 'Processa hormônios do estresse (depuração de glicocorticoides e catecolaminas) e coordena a glicogenólise na resposta de luta ou fuga.',
    topographicalRelations: 'Ocupa a totalidade do hipocôndrio direito, epigástrio e estende-se ao hipocôndrio esquerdo, moldando-se sob a cúpula diafragmática direita.',
    clinicalSemiology: 'Hepatometria pela percussão e palpação do bordo hepático à manobra em garra de Mathieu ou Lemos Torres.'
  },
  'diaphragm': {
    domain: 'Pneumologia, Biomecânica & Medicina Psicossomática',
    functionalRole: 'Principal músculo inspiratório, separando as cavidades torácica e abdominal.',
    neurobiologyPsychophysiology: 'Inervado pelos nervos frênicos (C3-C5). A respiração diafragmática lenta estimula mecanorreceptores e aferências vagais, ativando o sistema parassimpático e reduzindo a ansiedade somática.',
    topographicalRelations: 'Apresenta três hiatos principais: hiato da veia cava inferior (T8), hiato esofágico (T10) e hiato aórtico (T12).',
    clinicalSemiology: 'Avaliação da excursão respiratória toracoabdominal e mobilidade das cúpulas diafragmáticas.'
  },
  'lung': {
    domain: 'Pneumologia & Fisiologia da Hematose',
    functionalRole: 'Trocas gasosas (hematose) entre o ar alveolar e o sangue capilar pulmonar, mantendo a homeostase ácido-base sistêmica.',
    neurobiologyPsychophysiology: 'A frequência respiratória reflete estados emocionais e níveis de ativação simpática através do centro respiratório bulbar e quimiorreceptores carotídeos.',
    topographicalRelations: 'Contidos nas cavidades pleurais laterais, separados pelo mediastino. O pulmão direito possui 3 lobos e o esquerdo 2 lobos com a incisura cardíaca.',
    clinicalSemiology: 'Ausculta do murmúrio vesicular universal, percussão do som claro pulmonar e frêmito toracovocal.'
  },
  'kidney': {
    domain: 'Nefrologia & Equilíbrio Hidroeletrolítico',
    functionalRole: 'Filtração glomerular, regulação da volemia, osmolalidade, equilíbrio hidroeletrolítico e controle da pressão arterial via sistema renina-angiotensina-aldosterona.',
    neurobiologyPsychophysiology: 'As glândulas adrenais em seu polo superior produzem cortisol e catecolaminas essenciais para a adaptação biológica ao estresse.',
    topographicalRelations: 'Órgãos retroperitoneais situados entre T12 e L3. O rim direito situa-se ligeiramente mais baixo devido ao lobo direito do fígado.',
    clinicalSemiology: 'Pesquisa do sinal de Giordano (punho-percussão lombar) e palpação bimanual de Guyon.'
  },
  'pancreas': {
    domain: 'Endocrinologia & Gastroenterologia',
    functionalRole: 'Glândula mista com função exócrina (suco pancreático com tripsina, amilase e lipase) e endócrina (ilhotas de Langerhans secretoras de insulina e glucagon).',
    neurobiologyPsychophysiology: 'A secreção de insulina e glucagon é modulada pelo estresse neuroendócrino, influenciando o metabolismo glicêmico e a resposta energética global.',
    topographicalRelations: 'Estrutura retroperitoneal disposta obliquamente no epigástrio, com a cabeça encaixada na curvatura em C do duodeno e a cauda contactando o hilo esplênico.',
    clinicalSemiology: 'Palpação profunda de pontos pancreáticos e avaliação de sinais de pancreatite aguda (sinal de Cullen e Grey-Turner).'
  },
  'aorta': {
    domain: 'Cirurgia Vascular & Hemodinâmica',
    functionalRole: 'Principal tronco arterial sistêmico, com alta complacência elástica que atenua a pulsatilidade sistólica ventricular (efeito Windkessel).',
    neurobiologyPsychophysiology: 'Abriga no arco aórtico barorreceptores e corpos aórticos que detectam variações rápidas de pressão arterial e oxigenação para o controle neural reflexo da circulação.',
    topographicalRelations: 'Origina-se no ventrículo esquerdo, curva-se superiormente formando o arco aórtico (de onde emergem o tronco braquiocefálico, carótida comum esquerda e subclávia esquerda) e descende pelo mediastino posterior até a bifurcação ilíaca em L4.',
    clinicalSemiology: 'Palpação da pulsação aórtica abdominal no epigástrio e ausculta de sopros vasculares.'
  }
};

export const EXPLANATIONS: Record<string, string> = {
  'heart': 'Coração: Bomba muscular oca localizada no mediastino médio. O lado direito direciona o sangue desoxigenado aos pulmões; o lado esquerdo bombeia sangue oxigenado para a circulação sistêmica.',
  'liver': 'Fígado: Maior víscera abdominal, situada sob a cúpula diafragmática direita. Atua no metabolismo de carboidratos, biotransformação de xenobióticos, síntese de albumina e secreção de bile.',
  'brain': 'Encéfalo: Órgão central do sistema nervoso contido no neurocrânio. Suas regiões integradas sustentam motricidade voluntária, percepção somestésica, cognição superior e controle autonômico visceral.',
  'stomach': 'Estômago: Dilatação muscular do tubo digestório entre o esôfago distal e o duodeno. Realiza digestão enzimática e ácida, maceração mecânica do bolo alimentar e formação do quimo.',
  'spleen': 'Baço: Maior órgão linfoide secundário, posicionado no hipocôndrio esquerdo. Filtra o sangue, realiza hemocaterese fisiológica de eritrócitos senescentes e coordena respostas imunes a antígenos circulantes.',
  'pancreas': 'Pâncreas: Glândula mista retroperitoneal. Sua fração exócrina secreta suco pancreático rico em bicarbonato e zimogênios; as ilhotas de Langerhans secretam insulina, glucagon e somatostatina.',
  'urinary bladder': 'Bexiga urinária: Reservatório muscular distensível localizado no espaço pélvico subperitoneal. Armazena a urina conduzida pelos ureteres até a deflagração do reflexo miccional.',
  'trachea': 'Traqueia: Tubo cartilaginoso que estende a via aérea da laringe até a bifurcação da carina brônquica. Os anéis cartilaginosos incompletos garantem a patência luminal contínua.',
  'diaphragm': 'Diafragma: Músculo esquelético cúpula-forme que separa o tórax do abdômen. Principal efetor da mecânica inspiratória, cuja contração reduz a pressão intratorácica permitindo o influxo de ar.',
  'kidney': 'Rim: Órgão glandular par localizado no retroperitônio. Regula volume extracelular, balanço hidroeletrolítico, equilíbrio ácido-básico e secreta eritropoetina e renina.',
  'left kidney': 'Rim esquerdo: Órgão retroperitoneal situado entre T12 e L3, discretamente mais cranial que o rim direito em virtude da ausência da grande massa hepática deste lado.',
  'right kidney': 'Rim direito: Posicionado no flanco direito posterior do retroperitônio, ligeiramente mais baixo devido ao lobo hepático direito. Drena urina pelo ureter direito.',
  'lung': 'Pulmão: Órgão esponjoso par localizado na cavidade pleural torácica. Sítio onde ocorre a hematose (troca gasosa de oxigênio por dióxido de carbono) através da membrana alvéolo-capilar.',
  'left lung': 'Pulmão esquerdo: Dividido em lobos superior e inferior pela fissura oblíqua. Apresenta a incisura cardíaca e a língula, acomodando a projeção ventricular do coração.',
  'right lung': 'Pulmão direito: Maior que o esquerdo e dividido em três lobos (superior, médio e inferior) pelas fissuras horizontal e oblíqua. Recebe o brônquio principal direito.',
  'aorta': 'Aorta: Tronco arterial sistêmico primário emergente do ventrículo esquerdo. Conduz sangue oxigenado a todos os tecidos corpóreos através dos segmentos ascendente, arco e descendente.',
  'ascending aorta': 'Aorta ascendente: Primeiro segmento aórtico originado no ventrículo esquerdo. Dele emergem as artérias coronárias direita e esquerda responsáveis pela irrigação do miocárdio.',
  'arch of aorta': 'Arco da aorta: Curvatura vascular no mediastino superior. Dá origem ao tronco braquiocefálico, à artéria carótida comum esquerda e à artéria subclávia esquerda.',
  'thoracic aorta': 'Aorta torácica: Continuação descendente do arco aórtico no mediastino posterior até o hiato aórtico do diafragma (nível de T12). Emite ramos bronquiais, esofágicos e intercostais.',
  'abdominal aorta': 'Aorta abdominal: Segmento retroperitoneal que desce de T12 até L4, onde bifurca nas artérias ilíacas comuns. Emite o tronco celíaco e as artérias mesentéricas e renais.',
  'inferior vena cava': 'Veia cava inferior: Grande tronco venoso que conduz o sangue desoxigenado de membros inferiores, pelve e abdômen até o átrio direito do coração.',
  'superior vena cava': 'Veia cava superior: Tronco venoso calibroso que drena o sangue desoxigenado da cabeça, pescoço, membros superiores e tórax diretamente para o átrio direito.',
  'esophagus': 'Esôfago: Tubo fibromuscular de condução com cerca de 25 cm, estendendo-se da laringofaringe até o cárdia gástrico. Transporta o bolo alimentar através de ondas peristálticas ativas.',
  'gallbladder': 'Vesícula biliar: Reservatório sacular piriforme situado na fossa da face visceral do fígado. Armazena e concentra a bile sintetizada pelos hepatócitos até a estimulação pós-prandial.',
  'duodenum': 'Duodeno: Primeira porção do intestino delgado em forma de "C", contornando a cabeça do pâncreas. Recebe o quimo gástrico e as secreções biliar e pancreática na papila maior.',
  'jejunum': 'Jejuno: Segmento proximal móvel do intestino delgado intraperitoneal. Possui paredes espessas, pregas circulares densas e alta vascularização, otimizado para absorção de nutrientes.',
  'ileum': 'Íleo: Porção distal do intestino delgado, terminando na junção ileocecal. Possui folículos linfoides agregados (placas de Peyer) e absorve ativamente vitamina B12 e sais biliares.',
  'colon': 'Cólon: Segmento principal do intestino grosso composto pelos colos ascendente, transverso, descendente e sigmoide. Reabsorve água e eletrólitos e compacta os resíduos fecais.',
  'rectum': 'Reto: Porção terminal pélvica do tubo digestório anterior ao sacro e cóccix. Armazena o bolo fecal e se continua inferiormente através do canal anal.',
  'femur': 'Fêmur: Osso longo proximal do membro inferior. Transmite o peso corporal da cintura pélvica para a perna e serve de ancoragem para os potentes grupamentos musculares da marcha.',
  'tibia': 'Tíbia: Osso medial e principal sustentador de peso da perna. Articula-se proximalmente com os côndilos femorais e distalmente com o tálus na articulação do tornozelo.',
  'fibula': 'Fíbula: Osso lateral longo da perna. Serve primariamente de sítio de inserção muscular e participa da estabilidade articular do tornozelo através do maléolo lateral.',
  'humerus': 'Úmero: Osso longo do braço. Sua cabeça semiesférica se articula com a cavidade glenoide da escápula, permitindo ampla amplitude de movimentos multidirecionais.',
  'radius': 'Rádio: Osso lateral do antebraço. Capaz de girar sobre a ulna através das articulações radioulnares, possibilitando os movimentos biomecânicos de pronação e supinação.',
  'ulna': 'Ulna: Osso medial do antebraço. Seu olécrano se encaixa na fossa do olécrano do úmero, formando uma articulação em gínglimo estável para flexão e extensão do cotovelo.',
  'scapula': 'Escápula: Osso plano triangular do cíngulo superior localizado no dorso do tórax. Articula-se com a clavícula e o úmero e ancora os músculos do manguito rotador.',
  'clavicle': 'Clavícula: Osso longo em forma de "S" itálico que conecta o membro superior ao esqueleto axial através da articulação esternoclavicular. Atua como escora do ombro.',
  'sternum': 'Esterno: Osso plano médio anterior da caixa torácica, dividido em manúbrio, corpo e processo xifoide. Articula-se com as clavículas e com as primeiras 7 cartilagens costais.',
  'skull': 'Crânio: Estrutura óssea complexa dividida em neurocrânio (protetor do encéfalo) e viscerocrânio (esqueleto facial), com forames para passagem de nervos cranianos e vasos.',
  'mandible': 'Mandíbula: Único osso móvel do crânio. Aloja os alvéolos dentários inferiores e articula-se com os ossos temporais através da articulação temporomandibular (ATM).',
  'thyroid gland': 'Glândula tireoide: Glândula endócrina bilobada no pescoço anterior. Produz os hormônios T3 e T4, reguladores basais do ritmo metabólico celular de todos os tecidos corpóreos.',
  'cerebellum': 'Cerebelo: Estrutura na fossa craniana posterior. Coordena a precisão motora, a sincronização dos movimentos voluntários, o equilíbrio postural e a aprendizagem motora.',
  'spinal cord': 'Medula espinhal: Feixe cilíndrico de tecido neural contido no canal vertebral. Conduz vias ascendentes e descendentes e atua como centro reflexo somático e visceral.'
};

export const COMMON_NAME_TRANSLATIONS: Record<string, string> = {
  'heart': 'Coração',
  'liver': 'Fígado',
  'brain': 'Encéfalo',
  'stomach': 'Estômago',
  'spleen': 'Baço',
  'pancreas': 'Pâncreas',
  'urinary bladder': 'Bexiga Urinária',
  'trachea': 'Traqueia',
  'diaphragm': 'Diafragma',
  'kidney': 'Rim',
  'left kidney': 'Rim Esquerdo',
  'right kidney': 'Rim Direito',
  'lung': 'Pulmão',
  'left lung': 'Pulmão Esquerdo',
  'right lung': 'Pulmão Direito',
  'aorta': 'Aorta',
  'ascending aorta': 'Aorta Ascendente',
  'arch of aorta': 'Arco da Aorta',
  'thoracic aorta': 'Aorta Torácica',
  'abdominal aorta': 'Aorta Abdominal',
  'femur': 'Fêmur',
  'left femur': 'Fêmur Esquerdo',
  'right femur': 'Fêmur Direito',
  'tibia': 'Tíbia',
  'fibula': 'Fíbula',
  'humerus': 'Úmero',
  'radius': 'Rádio',
  'ulna': 'Ulna',
  'skull': 'Crânio',
  'mandible': 'Mandíbula',
  'vertebra': 'Vértebra',
  'spine': 'Coluna Vertebral',
  'rib': 'Costela',
  'sternum': 'Esterno',
  'clavicle': 'Clavícula',
  'scapula': 'Escápula',
  'thyroid gland': 'Glândula Tireoide',
  'esophagus': 'Esôfago',
  'gallbladder': 'Vesícula Biliar',
  'duodenum': 'Duodeno',
  'jejunum': 'Jejuno',
  'ileum': 'Íleo',
  'colon': 'Cólon',
  'rectum': 'Reto',
  'inferior vena cava': 'Veia Cava Inferior',
  'superior vena cava': 'Veia Cava Superior',
  'wall of ventricle': 'Parede dos Ventrículos Cardíacos',
  'wall of left ventricle': 'Parede do Ventrículo Esquerdo',
  'wall of right ventricle': 'Parede do Ventrículo Direito',
  'wall of left atrium': 'Parede do Átrio Esquerdo',
  'wall of right atrium': 'Parede do Átrio Direito',
  'cavity of left ventricle': 'Cavidade do Ventrículo Esquerdo',
  'cavity of right ventricle': 'Cavidade do Ventrículo Direito',
  'cavity of left atrium': 'Cavidade do Átrio Esquerdo',
  'cavity of right atrium': 'Cavidade do Átrio Direito',
  'third ventricle': 'Terceiro Ventrículo Cerebral',
  'fourth ventricle': 'Quarto Ventrículo Cerebral',
  'lateral ventricle': 'Ventrículos Laterais',
  'left lateral ventricle': 'Ventrículo Lateral Esquerdo',
  'right lateral ventricle': 'Ventrículo Lateral Direito',
  'interventricular foramen': 'Forame Interventricular (de Monro)',
  // Principais Músculos & Estruturas Toracoabdominais
  'external oblique': 'M. Oblíquo Externo do Abdome',
  'left external oblique': 'M. Oblíquo Externo Esquerdo',
  'right external oblique': 'M. Oblíquo Externo Direito',
  'internal oblique': 'M. Oblíquo Interno do Abdome',
  'left internal oblique': 'M. Oblíquo Interno Esquerdo',
  'right internal oblique': 'M. Oblíquo Interno Direito',
  'rectus abdominis': 'M. Reto do Abdome',
  'left rectus abdominis': 'M. Reto do Abdome Esquerdo',
  'right rectus abdominis': 'M. Reto do Abdome Direito',
  'transversus abdominis': 'M. Transverso do Abdome',
  'pectoralis major': 'M. Peitoral Maior',
  'left pectoralis major': 'M. Peitoral Maior Esquerdo',
  'right pectoralis major': 'M. Peitoral Maior Direito',
  'pectoralis minor': 'M. Peitoral Menor',
  'deltoid': 'M. Deltoide',
  'left deltoid': 'M. Deltoide Esquerdo',
  'right deltoid': 'M. Deltoide Direito',
  'latissimus dorsi': 'M. Latíssimo do Dorso',
  'left latissimus dorsi': 'M. Latíssimo do Dorso Esquerdo',
  'right latissimus dorsi': 'M. Latíssimo do Dorso Direito',
  'trapezius': 'M. Trapézio',
  'left trapezius': 'M. Trapézio Esquerdo',
  'right trapezius': 'M. Trapézio Direito',
  'biceps brachii': 'M. Bíceps Braquial',
  'left biceps brachii': 'M. Bíceps Braquial Esquerdo',
  'right biceps brachii': 'M. Bíceps Braquial Direito',
  'triceps brachii': 'M. Tríceps Braquial',
  'left triceps brachii': 'M. Tríceps Braquial Esquerdo',
  'right triceps brachii': 'M. Tríceps Braquial Direito',
  'brachioradialis': 'M. Braquiorradial',
  'sternocleidomastoid': 'M. Esternocleidomastóideo',
  'left sternocleidomastoid': 'M. Esternocleidomastóideo Esquerdo',
  'right sternocleidomastoid': 'M. Esternocleidomastóideo Direito',
  'serratus anterior': 'M. Serrátil Anterior',
  'rectus femoris': 'M. Reto Femoral',
  'vastus lateralis': 'M. Vasto Lateral',
  'vastus medialis': 'M. Vasto Medial',
  'gastrocnemius': 'M. Gastrocnêmio',
  'soleus': 'M. Sóleo',
  'tibialis anterior': 'M. Tibial Anterior',
  'gluteus maximus': 'M. Glúteo Máximo',
  'gluteus medius': 'M. Glúteo Médio'
};

export function translateAnatomicalName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (ALL_TRANSLATIONS[trimmed]) {
    return ALL_TRANSLATIONS[trimmed];
  }
  const lower = trimmed.toLowerCase();
  if (LOWER_TRANSLATIONS.has(lower)) {
    return LOWER_TRANSLATIONS.get(lower)!;
  }
  if (COMMON_NAME_TRANSLATIONS[lower]) {
    return COMMON_NAME_TRANSLATIONS[lower];
  }
  // If no direct translation found, capitalize words nicely
  return trimmed.replace(/\b\w/g, c => c.toUpperCase());
}

export function explanation(name: string, system: SystemId): string {
  const low = name.toLowerCase().trim();
  if (EXPLANATIONS[low]) return EXPLANATIONS[low];
  
  const ptName = translateAnatomicalName(name);
  const sys = SYSTEMS.find(s => s.id === system);
  if (sys) {
    return `${ptName}: Estrutura componente do ${sys.name}. ${sys.description}`;
  }
  return `${ptName}: Estrutura anatômica catalogada pelo BodyParts3D com alta precisão tridimensional e correlação morfofuncional.`;
}
