export interface AnatomicalLandmark {
  id: string;
  name: string;
  latinName?: string;
  category: 'proeminencia' | 'articular' | 'depressao' | 'insercao' | 'vascular_neural' | 'outros';
  categoryLabel: string;
  relativePos: [number, number, number]; // [u, v, w] from 0 to 1 relative to bounding box
  leaderAngle?: 'left-up' | 'left-down' | 'right-up' | 'right-down' | 'up' | 'down';
  description: string;
  teachingNotes?: string; // Teacher presentation point
  clinicalRelevance?: string; // Clinical relevance
  quizHint?: string; // Clue for student mode
  isCustom?: boolean; // True if created by user
}

export interface ComputedLandmark extends AnatomicalLandmark {
  worldPosition: [number, number, number];
  isRightSide: boolean;
}

// Master database of anatomical landmarks (acidentes anatômicos)
export const LANDMARK_TEMPLATES: Record<string, AnatomicalLandmark[]> = {
  femur: [
    {
      id: 'femur-head',
      name: 'Cabeça do Fêmur',
      latinName: 'Caput femoris',
      category: 'articular',
      categoryLabel: 'Superfície Articular',
      relativePos: [0.18, 0.94, 0.65],
      leaderAngle: 'left-up',
      description: 'Superfície articular semiesférica revestida por cartilagem hialina que se articula com o acetábulo do quadril na articulação coxofemoral.',
      teachingNotes: 'Exibe a fóvea da cabeça do fêmur para inserção do ligamento da cabeça (artéria da cabeça do fêmur, ramo da obturatória).',
      clinicalRelevance: 'Vulnerável à necrose avascular pós-fratura do colo femoral por interrupção das artérias retinaculares.',
      quizHint: 'Superfície esférica proximal que se articula no acetábulo da pelve.'
    },
    {
      id: 'femur-neck',
      name: 'Colo do Fêmur',
      latinName: 'Collum femoris',
      category: 'proeminencia',
      categoryLabel: 'Região Anatômica de Carga',
      relativePos: [0.46, 0.88, 0.55],
      leaderAngle: 'left-up',
      description: 'Segmento piramidal achatado que une a cabeça do fêmur à diáfise formando um ângulo de inclinação médio de 125° a 130° com o corpo.',
      teachingNotes: 'O ângulo cérvico-diafisário normal evita o impacto com a pelve; desvios causam coxa vara (<120°) ou coxa valga (>135°).',
      clinicalRelevance: 'Principal sítio de fratura em idosos com osteoporose, frequentemente intracapsular.',
      quizHint: 'Estrutura cilíndrica inclinada que conecta a cabeça ao corpo do fêmur.'
    },
    {
      id: 'femur-greater-trochanter',
      name: 'Trocanter Maior',
      latinName: 'Trochanter major',
      category: 'insercao',
      categoryLabel: 'Acidente de Inserção Muscular',
      relativePos: [0.90, 0.89, 0.45],
      leaderAngle: 'right-up',
      description: 'Grande proeminência quadrilátera na face súpero-lateral da junção do colo com a diáfise.',
      teachingNotes: 'Local primordial de inserção dos músculos glúteo médio, glúteo mínimo e piriforme — potentes abdutores e rotadores do quadril.',
      clinicalRelevance: 'Palpável na face lateral da coxa. Sítio de bursite trocantérica dolorosa e referência para punção ou vias cirúrgicas.',
      quizHint: 'Grande saliência óssea lateral palpável na extremidade proximal do fêmur.'
    },
    {
      id: 'femur-lesser-trochanter',
      name: 'Trocanter Menor',
      latinName: 'Trochanter minor',
      category: 'insercao',
      categoryLabel: 'Acidente de Inserção Muscular',
      relativePos: [0.32, 0.77, 0.16],
      leaderAngle: 'left-down',
      description: 'Eminência cônica que se projeta medial e posteriormente da base do colo femoral.',
      teachingNotes: 'Inserção distal do tendão do músculo iliopsoas, o flexor mais potente do quadril e estabilizador lombar.',
      clinicalRelevance: 'Fraturas avulsivas do trocanter menor em adultos jovens podem sinalizar contração espasmódica, mas em idosos sugerem lesão patológica.',
      quizHint: 'Pequena projeção medial e posterior onde se fixa o músculo iliopsoas.'
    },
    {
      id: 'femur-shaft',
      name: 'Diáfise / Linha Áspera',
      latinName: 'Corpus femoris / Linea aspera',
      category: 'insercao',
      categoryLabel: 'Corpo Ósseo Longitudinal',
      relativePos: [0.55, 0.52, 0.28],
      leaderAngle: 'right-up',
      description: 'Corpo cilíndrico robusto com leve convexidade anterior e uma proeminente crista posterior longitudinal: a linha áspera.',
      teachingNotes: 'A linha áspera se bifurca proximalmente em tuberosidade glútea e linha pectínea, e distalmente em linhas supracondilares medial e lateral.',
      clinicalRelevance: 'Sítio de fraturas diafisárias de alta energia traumática (acidentes de trânsito) com risco de sangramento de até 1.500 ml.',
      quizHint: 'Corpo do fêmur contendo uma crista longitudinal na sua face posterior.'
    },
    {
      id: 'femur-medial-epicondyle',
      name: 'Epicôndilo Medial',
      latinName: 'Epicondylus medialis',
      category: 'proeminencia',
      categoryLabel: 'Proeminência Ligamentar',
      relativePos: [0.15, 0.08, 0.42],
      leaderAngle: 'left-down',
      description: 'Maior proeminência medial localizada superiormente ao côndilo medial.',
      teachingNotes: 'Fixação proximal do ligamento colateral tibial (LCM) e abriga o tubérculo do adutor (inserção do adutor magno).',
      clinicalRelevance: 'Ponto sensível na avaliação de entorses de joelho com lesão do ligamento colateral medial.',
      quizHint: 'Eminência medial acima do côndilo para fixação do ligamento colateral tibial.'
    },
    {
      id: 'femur-lateral-epicondyle',
      name: 'Epicôndilo Lateral',
      latinName: 'Epicondylus lateralis',
      category: 'proeminencia',
      categoryLabel: 'Proeminência Ligamentar',
      relativePos: [0.88, 0.08, 0.42],
      leaderAngle: 'right-down',
      description: 'Menor e menos proeminente que o medial, localizado na face lateral acima do côndilo.',
      teachingNotes: 'Fixação do ligamento colateral fibular (LCL) e da cabeça lateral do músculo gastrocnêmio e tendão poplíteo.',
      clinicalRelevance: 'Estabilizador essencial do joelho contra forças em varo articular.',
      quizHint: 'Eminência lateral acima do côndilo onde se fixa o ligamento colateral fibular.'
    },
    {
      id: 'femur-medial-condyle',
      name: 'Côndilo Medial',
      latinName: 'Condylus medialis',
      category: 'articular',
      categoryLabel: 'Superfície Articular Distal',
      relativePos: [0.22, 0.02, 0.28],
      leaderAngle: 'left-down',
      description: 'Massa articular convexa distal e medial que se articula com o menisco e o platô tibial medial.',
      teachingNotes: 'Mais longo e curvilíneo que o lateral, permitindo o mecanismo de rotação automática final ("screw-home") da extensão do joelho.',
      clinicalRelevance: 'Área comumente acometida por osteoartrite e osteocondrite dissecante de joelho.',
      quizHint: 'Superfície articular inferior medial do fêmur que se apoia sobre a tíbia.'
    },
    {
      id: 'femur-lateral-condyle',
      name: 'Côndilo Lateral',
      latinName: 'Condylus lateralis',
      category: 'articular',
      categoryLabel: 'Superfície Articular Distal',
      relativePos: [0.80, 0.02, 0.28],
      leaderAngle: 'right-down',
      description: 'Massa articular mais larga e orientada no sentido anteroposterior para articular com o platô tibial lateral.',
      teachingNotes: 'Apresenta curvatura menor e crista troclear lateral mais alta para prevenir luxação lateral da patela.',
      clinicalRelevance: 'Fraturas condilares distais requerem redução anatômica precisa para evitar incongruência femorotibial.',
      quizHint: 'Superfície articular inferior lateral do fêmur para o platô tibial.'
    },
    {
      id: 'femur-intercondylar-fossa',
      name: 'Fossa Intercondilar',
      latinName: 'Fossa intercondylaris',
      category: 'depressao',
      categoryLabel: 'Depressão Ligamentar Central',
      relativePos: [0.51, 0.03, 0.14],
      leaderAngle: 'down',
      description: 'Profundo entalhe localizado posteriormente entre os dois côndilos femorais.',
      teachingNotes: 'Acomoda os ligamentos cruzados anterior e posterior (LCA e LCP) do joelho, sem ser revestida por cartilagem articular.',
      clinicalRelevance: 'Área de impacto ("notch impingement") em enxertos ligamentares de reconstrução de LCA.',
      quizHint: 'Depressão profunda posterior entre os côndilos onde cruzam os ligamentos LCA e LCP.'
    }
  ],

  humerus: [
    {
      id: 'humerus-head',
      name: 'Cabeça do Úmero',
      latinName: 'Caput humeri',
      category: 'articular',
      categoryLabel: 'Superfície Articular Superior',
      relativePos: [0.25, 0.94, 0.45],
      leaderAngle: 'left-up',
      description: 'Superfície hemisférica lisa voltada medial, superior e ligeiramente posterior.',
      teachingNotes: 'Articula-se com a cavidade glenoide da escápula (articulação glenoumeral), conferindo a maior amplitude de movimento do corpo.',
      clinicalRelevance: 'Vulnerável a luxação anterior do ombro em esportes de arremesso e quedas com braço abduzido.',
      quizHint: 'Superfície esférica proximal que se articula na cavidade glenoide.'
    },
    {
      id: 'humerus-greater-tubercle',
      name: 'Tubérculo Maior',
      latinName: 'Tuberculum majus',
      category: 'insercao',
      categoryLabel: 'Acidente de Inserção Muscular',
      relativePos: [0.85, 0.92, 0.50],
      leaderAngle: 'right-up',
      description: 'Eminência lateral proeminente na extremidade superior do úmero.',
      teachingNotes: 'Possui 3 facetas de inserção para o manguito rotador: supraespinhal, infraespinhal e redondo menor.',
      clinicalRelevance: 'Fraturas com desvio do tubérculo maior comprometem a função de abdução e rotação externa do ombro.',
      quizHint: 'Projeção lateral superior onde se inserem três músculos do manguito rotador.'
    },
    {
      id: 'humerus-lesser-tubercle',
      name: 'Tubérculo Menor',
      latinName: 'Tuberculum minus',
      category: 'insercao',
      categoryLabel: 'Acidente de Inserção Muscular',
      relativePos: [0.45, 0.88, 0.85],
      leaderAngle: 'left-up',
      description: 'Projeção anterior separada do tubérculo maior pelo sulco intertubercular.',
      teachingNotes: 'Inserção do músculo subescapular, potente rotador interno do ombro.',
      clinicalRelevance: 'Avulsão pode ocorrer em luxações posteriores raras do ombro.',
      quizHint: 'Proeminência anterior onde se insere o músculo subescapular.'
    },
    {
      id: 'humerus-deltoid-tuberosity',
      name: 'Tuberosidade Deltoidea',
      latinName: 'Tuberositas deltoidea',
      category: 'insercao',
      categoryLabel: 'Crista Muscular Diafisária',
      relativePos: [0.72, 0.55, 0.70],
      leaderAngle: 'right-up',
      description: 'Elevação rugosa triangular na face anterolateral do meio da diáfise umeral.',
      teachingNotes: 'Inserção terminal do músculo deltoide, principal abdutor do ombro acima dos 15°.',
      clinicalRelevance: 'Ponto de referência radiológico e cirúrgico para osteossínteses de diáfise de úmero.',
      quizHint: 'Rugosidade na metade lateral da diáfise onde o músculo deltoide se insere.'
    },
    {
      id: 'humerus-medial-epicondyle',
      name: 'Epicôndilo Medial',
      latinName: 'Epicondylus medialis',
      category: 'proeminencia',
      categoryLabel: 'Eminência Flexora e Neural',
      relativePos: [0.15, 0.06, 0.40],
      leaderAngle: 'left-down',
      description: 'Grande projeção medial facilmente palpável na face interna do cotovelo.',
      teachingNotes: 'Origem do tendão flexor comum do antebraço. Em sua face posterior corre o nervo ulnar no sulco do nervo ulnar.',
      clinicalRelevance: 'Sítio de epicondilite medial ("cotovelo de golfista") e neuropatia compressiva ulnar.',
      quizHint: 'Proeminência medial do cotovelo onde corre o nervo ulnar posteriormente.'
    },
    {
      id: 'humerus-lateral-epicondyle',
      name: 'Epicôndilo Lateral',
      latinName: 'Epicondylus lateralis',
      category: 'proeminencia',
      categoryLabel: 'Eminência Extensora',
      relativePos: [0.85, 0.08, 0.40],
      leaderAngle: 'right-down',
      description: 'Menor que o medial, situado na borda lateral distal.',
      teachingNotes: 'Origem do tendão extensor comum dos dedos e punho.',
      clinicalRelevance: 'Sítio de epicondilite lateral ("cotovelo de tenista"), uma das tendinopatias mais comuns em adultos.',
      quizHint: 'Proeminência lateral distal do úmero onde se originam os extensores do punho.'
    },
    {
      id: 'humerus-trochlea',
      name: 'Tróclea e Capítulo',
      latinName: 'Trochlea & Capitulum humeri',
      category: 'articular',
      categoryLabel: 'Superfícies Articulares do Cotovelo',
      relativePos: [0.50, 0.02, 0.50],
      leaderAngle: 'down',
      description: 'A tróclea articula com a incisura troclear da ulna; o capítulo articula com a cabeça do rádio.',
      teachingNotes: 'O capítulo é esferoidal e lateral; a tróclea é medial em formato de carretel.',
      clinicalRelevance: 'Fraturas intercondilares do úmero distal exigem reconstrução rígida para evitar anquilose do cotovelo.',
      quizHint: 'Conjunto articular distal que se conecta à ulna e ao rádio.'
    },
    {
      id: 'humerus-olecranon-fossa',
      name: 'Fossa do Olécrano',
      latinName: 'Fossa olecrani',
      category: 'depressao',
      categoryLabel: 'Depressão Posterior de Encaixe',
      relativePos: [0.50, 0.06, 0.12],
      leaderAngle: 'left-down',
      description: 'Depressão triangular profunda na face posterior distal acima da tróclea.',
      teachingNotes: 'Recebe o olécrano da ulna durante a extensão completa do antebraço.',
      clinicalRelevance: 'Osteófitos marginais na fossa do olécrano causam perda de extensão terminal do cotovelo.',
      quizHint: 'Fossa posterior profunda onde o bico do olécrano se encaixa na extensão.'
    }
  ],

  tibia: [
    {
      id: 'tibia-condyles',
      name: 'Côndilos Medial e Lateral / Platô Tibial',
      latinName: 'Condyli tibiae / Facies articularis superior',
      category: 'articular',
      categoryLabel: 'Plataforma Articular de Carga',
      relativePos: [0.50, 0.96, 0.50],
      leaderAngle: 'up',
      description: 'Plataforma óssea proximal expandida que recebe os côndilos femorais e aloja os meniscos.',
      teachingNotes: 'Apresenta a eminência intercondilar central onde se fixam os ligamentos cruzados e meniscos.',
      clinicalRelevance: 'Fraturas do platô tibial (classificação de Schatzker) frequentemente envolvem lesão meniscal associada.',
      quizHint: 'Plataforma superior da tíbia que sustenta o fêmur e os meniscos.'
    },
    {
      id: 'tibia-tuberosity',
      name: 'Tuberosidade da Tíbia',
      latinName: 'Tuberositas tibiae',
      category: 'insercao',
      categoryLabel: 'Inserção do Aparelho Extensor',
      relativePos: [0.50, 0.88, 0.88],
      leaderAngle: 'right-up',
      description: 'Grande elevação rugosa anterior palpável abaixo da linha articular do joelho.',
      teachingNotes: 'Ponto terminal de inserção do ligamento/tendão patelar, transmitindo a força contrátil do quadríceps femoral.',
      clinicalRelevance: 'Sítio da osteocondrose de tração infantil/adolescente (doença de Osgood-Schlatter).',
      quizHint: 'Elevação anterior palpável onde se insere o tendão patelar do quadríceps.'
    },
    {
      id: 'tibia-anterior-border',
      name: 'Borda Anterior (Canela)',
      latinName: 'Margo anterior',
      category: 'proeminencia',
      categoryLabel: 'Crista Subcutânea Palpável',
      relativePos: [0.48, 0.50, 0.75],
      leaderAngle: 'left-up',
      description: 'Crista sinuosa aguda anterior que se estende da tuberosidade tibial até o maléolo medial.',
      teachingNotes: 'Recoberta quase exclusivamente por pele e tecido subcutâneo sem interposição muscular.',
      clinicalRelevance: 'Alta incidência de fraturas expostas por trauma direto e estresse em corredores (canelite).',
      quizHint: 'Borda anterior afiada e subcutânea comumente chamada de canela.'
    },
    {
      id: 'tibia-medial-malleolus',
      name: 'Maléolo Medial',
      latinName: 'Malleolus medialis',
      category: 'proeminencia',
      categoryLabel: 'Pilão Articular do Tornozelo',
      relativePos: [0.30, 0.04, 0.55],
      leaderAngle: 'left-down',
      description: 'Proeminência óssea medial distal que se projeta inferiormente para estabilizar a articulação talocrural.',
      teachingNotes: 'Sua face externa articula-se com a face maleolar medial do tálus. Fixação do ligamento deltoide.',
      clinicalRelevance: 'Componente das fraturas bimaleolares e trimaleolares do tornozelo.',
      quizHint: 'Eminência óssea medial do tornozelo que abraça o tálus.'
    }
  ],

  fibula: [
    {
      id: 'fibula-head',
      name: 'Cabeça da Fíbula',
      latinName: 'Caput fibulae',
      category: 'articular',
      categoryLabel: 'Extremidade Proximal e Ligamentar',
      relativePos: [0.50, 0.95, 0.50],
      leaderAngle: 'right-up',
      description: 'Expansão proximal arredondada articulada com o côndilo lateral da tíbia.',
      teachingNotes: 'Inserção do tendão do bíceps femoral e ligamento colateral fibular. O nervo fibular comum contorna seu colo.',
      clinicalRelevance: 'Trauma local pode lesar o nervo fibular comum, gerando pé caído (queda do antepé).',
      quizHint: 'Extremidade superior da fíbula contornada pelo nervo fibular comum.'
    },
    {
      id: 'fibula-lateral-malleolus',
      name: 'Maléolo Lateral',
      latinName: 'Malleolus lateralis',
      category: 'proeminencia',
      categoryLabel: 'Pilão Lateral do Tornozelo',
      relativePos: [0.50, 0.05, 0.50],
      leaderAngle: 'right-down',
      description: 'Extremidade distal expandida que desce mais distalmente que o maléolo medial.',
      teachingNotes: 'Fixação dos ligamentos talofibulares anterior e posterior e calcaneofibular.',
      clinicalRelevance: 'O ligamento talofibular anterior no maléolo lateral é o mais lesionado em entorses de tornozelo por inversão.',
      quizHint: 'Eminência lateral do tornozelo, mais saliente e distal que o medial.'
    }
  ],

  scapula: [
    {
      id: 'scapula-acromion',
      name: 'Acrômio',
      latinName: 'Acromion',
      category: 'articular',
      categoryLabel: 'Cúpula Superior do Ombro',
      relativePos: [0.85, 0.92, 0.70],
      leaderAngle: 'right-up',
      description: 'Grande projeção óssea achatada que se curva anteriormente sobre a articulação glenoumeral.',
      teachingNotes: 'Articula-se com a clavícula na articulação acromioclavicular (AC).',
      clinicalRelevance: 'Variações anatômicas (acrômio ganchoso tipo III de Bigliani) causam síndrome do impacto subacromial.',
      quizHint: 'Ponto mais alto do ombro que se articula com a clavícula.'
    },
    {
      id: 'scapula-coracoid',
      name: 'Processo Coracoide',
      latinName: 'Processus coracoideus',
      category: 'insercao',
      categoryLabel: 'Projeção Anterior em Bico',
      relativePos: [0.70, 0.85, 0.95],
      leaderAngle: 'left-up',
      description: 'Projeção óssea espessa curva que se assemelha ao bico de um corvo, orientada anterolateralmente.',
      teachingNotes: 'Inserção do músculo peitoral menor e origem comum do coracobraquial e cabeça curta do bíceps.',
      clinicalRelevance: 'Ponto de referência cirúrgico no ombro ("o farol do cirurgião").',
      quizHint: 'Projeção anterior em forma de bico onde se fixa a cabeça curta do bíceps.'
    },
    {
      id: 'scapula-spine',
      name: 'Espinha da Escápula',
      latinName: 'Spina scapulae',
      category: 'proeminencia',
      categoryLabel: 'Crista Dorsal Posterior',
      relativePos: [0.50, 0.78, 0.20],
      leaderAngle: 'left-up',
      description: 'Placa óssea proeminente que cruza obliquamente o dorso da escápula até se continuar como acrômio.',
      teachingNotes: 'Divide a face posterior em fossa supraespinal e fossa infraespinal.',
      clinicalRelevance: 'Facilmente palpável no dorso humano como marco de T3.',
      quizHint: 'Crista óssea saliente no dorso da escápula que termina no acrômio.'
    },
    {
      id: 'scapula-glenoid',
      name: 'Cavidade Glenoide',
      latinName: 'Cavitas glenoidalis',
      category: 'articular',
      categoryLabel: 'Fossa Articular do Ombro',
      relativePos: [0.88, 0.75, 0.65],
      leaderAngle: 'right-down',
      description: 'Fossa rasa ovalada na face súpero-lateral da escápula que recebe a cabeça do úmero.',
      teachingNotes: 'Circundada pelo lábio glenoidal (labrum), que aprofunda a articulação.',
      clinicalRelevance: 'Lesões do lábio glenoidal (Bankart e SLAP) causam instabilidade crônica do ombro.',
      quizHint: 'Superfície rasa onde a cabeça do úmero se articula.'
    }
  ],

  mandible: [
    {
      id: 'mandible-condylar',
      name: 'Processo Condilar (Cabeça da Mandíbula)',
      latinName: 'Processus condylaris',
      category: 'articular',
      categoryLabel: 'Côndilo da ATM',
      relativePos: [0.88, 0.92, 0.25],
      leaderAngle: 'right-up',
      description: 'Eminência articular cilíndrica com eixo transverso voltado para a fossa mandibular do osso temporal.',
      teachingNotes: 'Interposto pelo disco articular na Articulação Temporomandibular (ATM).',
      clinicalRelevance: 'Disfunção temporomandibular (DTM) e fraturas por golpe direto no queixo.',
      quizHint: 'Extremidade posterior superior que se encaixa no osso temporal formando a ATM.'
    },
    {
      id: 'mandible-coronoid',
      name: 'Processo Coronoide',
      latinName: 'Processus coronoideus',
      category: 'insercao',
      categoryLabel: 'Inserção Mastigatória',
      relativePos: [0.80, 0.88, 0.60],
      leaderAngle: 'right-up',
      description: 'Lâmina triangular pontiaguda na borda superior anterior do ramo mandibular.',
      teachingNotes: 'Inserção distal do potente músculo temporal.',
      clinicalRelevance: 'A hipertrofia do processo coronoide pode limitar a abertura bucal (trismo).',
      quizHint: 'Projeção triangular anterior do ramo onde se insere o músculo temporal.'
    },
    {
      id: 'mandible-angle',
      name: 'Ângulo da Mandíbula (Gônio)',
      latinName: 'Angulus mandibulae',
      category: 'proeminencia',
      categoryLabel: 'Vértice Ântero-Posterior',
      relativePos: [0.85, 0.35, 0.25],
      leaderAngle: 'right-down',
      description: 'Região de transição entre a borda inferior do corpo e a borda posterior do ramo da mandíbula.',
      teachingNotes: 'Inserção do músculo masseter na face lateral e do músculo pterigoideo medial na face medial.',
      clinicalRelevance: 'Ponto anatômico de referência cefalométrica e marco cirúrgico facial.',
      quizHint: 'Ângulo póstero-inferior da mandíbula onde o músculo masseter se insere.'
    },
    {
      id: 'mandible-mental-protuberance',
      name: 'Protuberância Mentual (Queixo)',
      latinName: 'Protuberantia mentalis',
      category: 'proeminencia',
      categoryLabel: 'Sínfise e Mento Facial',
      relativePos: [0.50, 0.15, 0.95],
      leaderAngle: 'down',
      description: 'Elevação óssea triangular na linha mediana anterior do corpo mandibular.',
      teachingNotes: 'Exclusividade evolutiva dos hominídeos modernos (*Homo sapiens*). Lateralmente estão os forames mentuais.',
      clinicalRelevance: 'O forame mentual adjacente é alvo de bloqueio anestésico em odontologia e cirurgia plástica.',
      quizHint: 'Saliência triangular mediana que forma o queixo humano.'
    }
  ],

  'hip bone': [
    {
      id: 'hip-iliac-crest',
      name: 'Crista Ilíaca',
      latinName: 'Crista iliaca',
      category: 'proeminencia',
      categoryLabel: 'Borda Superior Palpável',
      relativePos: [0.50, 0.95, 0.50],
      leaderAngle: 'up',
      description: 'Margem superior curvilínea e espessa da asa do ílio.',
      teachingNotes: 'Sítio de fixação dos músculos abdominais (oblíquos e transverso) e grande dorsal.',
      clinicalRelevance: 'Ponto de referência topográfico ao nível do espaço vertebral L4-L5 para punção lombar e biópsia de medula óssea.',
      quizHint: 'Margem superior em arco da bacia, facilmente palpável na cintura.'
    },
    {
      id: 'hip-asis',
      name: 'Espinha Ilíaca Anterossuperior (EIAS)',
      latinName: 'Spina iliaca anterior superior',
      category: 'insercao',
      categoryLabel: 'Marco Anatômico Clínico',
      relativePos: [0.88, 0.72, 0.90],
      leaderAngle: 'right-up',
      description: 'Projeção óssea anterior proeminente no término anterior da crista ilíaca.',
      teachingNotes: 'Origem do músculo sartório e fixação lateral do ligamento inguinal.',
      clinicalRelevance: 'Marco clínico para medir comprimento aparente de membros inferiores e aplicar injeção intramuscular ventroglútea.',
      quizHint: 'Ponto ósseo anterior saliente da pelve onde se prende o ligamento inguinal.'
    },
    {
      id: 'hip-acetabulum',
      name: 'Acetábulo',
      latinName: 'Acetabulum',
      category: 'articular',
      categoryLabel: 'Cúpula Cotiloide Articular',
      relativePos: [0.85, 0.35, 0.55],
      leaderAngle: 'right-down',
      description: 'Cavidade hemisférica profunda formada pela fusão dos ossos ílio, ísquio e púbis.',
      teachingNotes: 'Apresenta a face semilunar cartilaginosa e a fossa do acetábulo no fundo.',
      clinicalRelevance: 'Articula-se com a cabeça do fêmur. Fraturas acetabulares por impacto de alta energia necessitam de reconstrução tridimensional.',
      quizHint: 'Cavidade profunda da bacia que acomoda a cabeça do fêmur.'
    },
    {
      id: 'hip-ischial-tuberosity',
      name: 'Tuberosidade Isquiática',
      latinName: 'Tuber ischiadicum',
      category: 'insercao',
      categoryLabel: 'Apoio de Carga Postural',
      relativePos: [0.45, 0.08, 0.15],
      leaderAngle: 'left-down',
      description: 'Grande massa óssea rugosa na curvatura inferior do ísquio.',
      teachingNotes: 'Sustenta o peso de todo o tronco na posição sentada e dá origem aos músculos isquiotibiais.',
      clinicalRelevance: 'Sítio de úlceras de pressão ("escaras") em pacientes cadeirantes e bursite isquiática.',
      quizHint: 'Proeminência inferior da bacia que apoia o peso do corpo ao sentar.'
    }
  ],
  heart: [
    {
      id: 'heart-apex',
      name: 'Ápice do Coração',
      latinName: 'Apex cordis',
      category: 'proeminencia',
      categoryLabel: 'Ponto de Pulso Cardíaco (Ictus)',
      relativePos: [0.82, 0.12, 0.68],
      leaderAngle: 'left-down',
      description: 'Extremidade cônica anteroinferior esquerda formada inteiramente pelo ventrículo esquerdo.',
      teachingNotes: 'Projeta-se no 5º espaço intercostal esquerdo na linha hemiclavicular (~7-9 cm da linha média esternal).',
      clinicalRelevance: 'Local de palpação do choque da ponta (ictus cordis) e ausculta do foco mitral com campânula do estetoscópio.',
      quizHint: 'Ponta inferior do coração projetada no 5º espaço intercostal esquerdo.'
    },
    {
      id: 'heart-base',
      name: 'Base do Coração',
      latinName: 'Basis cordis',
      category: 'proeminencia',
      categoryLabel: 'Face Posterior Atrial',
      relativePos: [0.38, 0.88, 0.22],
      leaderAngle: 'right-up',
      description: 'Face posterior e posterosuperior do coração, formada predominantemente pelo átrio esquerdo.',
      teachingNotes: 'Local onde emergem os grandes vasos (tronco pulmonar, aorta ascendente) e desembocam as veias cavas e pulmonares.',
      clinicalRelevance: 'Relação anatômica íntima com o esôfago posterior (usada no ecocardiograma transesofágico).',
      quizHint: 'Superfície posterior do coração formada pelo átrio esquerdo e vasos da base.'
    },
    {
      id: 'heart-sulcus-anterior',
      name: 'Sulco Interventricular Anterior',
      latinName: 'Sulcus interventricularis anterior',
      category: 'depressao',
      categoryLabel: 'Leito Vascular Coronário',
      relativePos: [0.54, 0.48, 0.86],
      leaderAngle: 'left-up',
      description: 'Depressão linear na face esternocostal do coração que demarca superficialmente a divisão entre os ventrículos.',
      teachingNotes: 'Abriga a artéria interventricular anterior (artéria descendente anterior - ADA) e a grande veia cardíaca.',
      clinicalRelevance: 'Artéria coronária descendente anterior é o vaso mais acometido por aterosclerose em infartos agudos do miocárdio (IAM).',
      quizHint: 'Sulco na face anterior entre os ventrículos por onde corre a artéria descendente anterior.'
    },
    {
      id: 'heart-sulcus-coronarius',
      name: 'Sulco Coronário (Atrioventricular)',
      latinName: 'Sulcus coronarius',
      category: 'depressao',
      categoryLabel: 'Transição Atrioventricular',
      relativePos: [0.32, 0.66, 0.58],
      leaderAngle: 'right-up',
      description: 'Sulco circular profundo que circunda o coração, separando funcionalmente os átrios dos ventrículos.',
      teachingNotes: 'Aloja a artéria coronária direita, o ramo circunflexo da coronária esquerda e o seio venoso coronário.',
      clinicalRelevance: 'Plano do esqueleto fibroso cardíaco que isola eletricamente os átrios dos ventrículos.',
      quizHint: 'Sulco anular que marca a fronteira externa entre átrios e ventrículos.'
    },
    {
      id: 'heart-conus-arteriosus',
      name: 'Cone Arterioso (Infundíbulo)',
      latinName: 'Conus arteriosus / Infundibulum',
      category: 'proeminencia',
      categoryLabel: 'Via de Saída Pulmonar',
      relativePos: [0.46, 0.80, 0.74],
      leaderAngle: 'right-up',
      description: 'Porção lisa e tubular do ventrículo direito de onde se origina o tronco da artéria pulmonar.',
      teachingNotes: 'Distingue-se do restante do ventrículo direito por não possuir trabéculas cárneas proeminentes.',
      clinicalRelevance: 'Estenose infundibular é um dos quatro componentes anatômicos da Tetralogia de Fallot.',
      quizHint: 'Cone de transição liso entre o ventrículo direito e o tronco pulmonar.'
    },
    {
      id: 'heart-interventricular-septum',
      name: 'Septo Interventricular',
      latinName: 'Septum interventriculare',
      category: 'proeminencia',
      categoryLabel: 'Parede Septal Cardíaca',
      relativePos: [0.48, 0.38, 0.48],
      leaderAngle: 'left-down',
      description: 'Parede oblíqua espessa que separa as cavidades ventriculares direita e esquerda.',
      teachingNotes: 'Composto por uma ampla parte muscular inferior e uma fina parte membranosa superior.',
      clinicalRelevance: 'Local da comunicação interventricular (CIV), a cardiopatia congênita acianogênica mais comum.',
      quizHint: 'Parede muscular espessa que separa o ventrículo esquerdo do ventrículo direito.'
    }
  ]
};

// Map part names to their landmark template key
export function getLandmarkKeyForPart(partName: string): string | null {
  const low = partName.toLowerCase();
  // Ensure cerebral ventricles do not match heart
  if (low.includes('third') || low.includes('fourth') || low.includes('lateral ventricle') || low.includes('cerebr')) {
    return null;
  }
  if (low.includes('femur')) return 'femur';
  if (low.includes('humerus')) return 'humerus';
  if (low.includes('tibia')) return 'tibia';
  if (low.includes('fibula')) return 'fibula';
  if (low.includes('scapula')) return 'scapula';
  if (low.includes('mandible')) return 'mandible';
  if (low.includes('hip bone') || low.includes('pelvis') || low.includes('ilium')) return 'hip bone';
  if (low.includes('heart') || low.includes('cardiac') || low.includes('atrium') || low.includes('cora') || low.includes('ventricle')) return 'heart';
  return null;
}

// Compute actual 3D world coordinates for landmarks on a given part
export function computePartLandmarks(
  partName: string,
  bounds: [number[], number[]]
): ComputedLandmark[] {
  const key = getLandmarkKeyForPart(partName);
  if (!key || !LANDMARK_TEMPLATES[key]) return [];

  const [min, max] = bounds;
  const isRight = partName.toLowerCase().startsWith('right');
  const sizeX = max[0] - min[0];
  const sizeY = max[1] - min[1];
  const sizeZ = max[2] - min[2];

  const templates = LANDMARK_TEMPLATES[key];
  return templates.map(t => {
    // Mirror u coordinate if right-sided bone
    const u = isRight ? 1 - t.relativePos[0] : t.relativePos[0];
    const v = t.relativePos[1];
    const w = t.relativePos[2];

    const worldX = min[0] + u * sizeX;
    const worldY = min[1] + v * sizeY;
    const worldZ = min[2] + w * sizeZ;

    // Invert leader horizontal angle if mirrored
    let leaderAngle = t.leaderAngle;
    if (isRight && leaderAngle) {
      if (leaderAngle.startsWith('left')) {
        leaderAngle = leaderAngle.replace('left', 'right') as any;
      } else if (leaderAngle.startsWith('right')) {
        leaderAngle = leaderAngle.replace('right', 'left') as any;
      }
    }

    return {
      ...t,
      leaderAngle,
      worldPosition: [worldX, worldY, worldZ],
      isRightSide: isRight
    };
  });
}
