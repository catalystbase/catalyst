/* =========================================================
   Две языковые версии страницы.

   Меняется ТОЛЬКО содержимое: тексты и обложки в веере.
   Раскладка, размеры, шрифт, порядок блоков и вся анимация
   общие для обеих версий — они заданы в CSS и main.js.

   Русские тексты — из website_content.rtf и issues_description.md,
   английские — из website_content_eng.rtf и issues_description_eng.md.
   Переносы строк расставлены вручную и проверены на трёх ширинах.
   ========================================================= */
window.CATALYST = window.CATALYST || {};

/* Английские выпуски: заголовки и описания — из issues_description_eng.md,
   обложки — отдельный комплект с английским набором. */
window.CATALYST.issuesEn = [
  {
    n: 1,
    title: 'Agile Manifesto',
    cover: 'assets/covers-en/cover01.jpg',
    desc: 'How software development works from idea to implementation and the role a systems\nanalyst plays in the process. The Agile Manifesto, development stages, software\narchitecture, and the competency matrix for Junior, Middle, and Senior specialists.'
  },
  {
    n: 2,
    title: 'Software Requirements Specification',
    cover: 'assets/covers-en/cover02.jpg',
    desc: 'How to identify, formulate, validate, and document software requirements.\nThe requirements lifecycle, use cases, quality criteria,\nand a checklist for reviewing specifications.'
  },
  {
    n: 3,
    title: 'Structured Query Language',
    cover: 'assets/covers-en/cover03.jpg',
    desc: 'SQL from basic operations to complex queries involving multiple tables.\nData selection, filtering, comparison, subqueries, CTEs, JOINs,\nand practical recommendations for formatting SQL code.'
  },
  {
    n: 4,
    title: 'Data Modeling',
    cover: 'assets/covers-en/cover04.jpg',
    desc: 'How to turn domain data into a clear and robust system model.\nER diagrams, UML Class/Object Diagrams, normalization,\ndata dictionaries, and choosing between SQL and NoSQL.'
  },
  {
    n: 5,
    title: 'Process Modeling',
    cover: 'assets/covers-en/cover05.jpg',
    desc: 'How to visualize and describe how a system works before development begins.\nBPMN, UML, State Machines, and Data Flow diagrams help model processes,\nidentify weak points, and compare AS-IS and TO-BE states.'
  },
  {
    n: 6,
    title: 'User Experience',
    cover: 'assets/covers-en/cover06.jpg',
    desc: 'How to design interfaces based on real user tasks and behavior.\nUser Journey Maps, design systems, interface structure,\nprototyping, and UX testing.'
  },
  {
    n: 7,
    title: 'Agile Artifacts',
    cover: 'assets/covers-en/cover07.jpg',
    desc: 'Working with requirements in agile development — from idea to sprint.\nUser Stories, Job Stories, INVEST, Story Points, MVP, DEEP,\nand principles for organizing a high-quality backlog.'
  },
  {
    n: 8,
    title: 'Software Architecture',
    cover: 'assets/covers-en/cover08.jpg',
    desc: 'How modern software systems are structured and how their components interact.\nClient-server architecture, monoliths and microservices, scaling,\nthe data path from request to database, and architectural diagrams.'
  },
  {
    n: 9,
    title: 'System Communication',
    cover: 'assets/covers-en/cover09.jpg',
    desc: 'How systems exchange data and “communicate” with one another.\nTCP/IP, queues and asynchronous communication, API design,\nJSON/XML, and the differences between SOAP and REST APIs.'
  },
  {
    n: 10,
    title: 'Software Development',
    cover: 'assets/covers-en/cover10.jpg',
    desc: 'What happens to a software product from source code to production release.\nProgramming languages, Git, collaborative development,\ntesting, and CI/CD pipelines.'
  },
  {
    n: 11,
    title: 'Project Delivery',
    cover: 'assets/covers-en/cover11.jpg',
    desc: 'What happens after development is complete and how a product moves into production.\nTransition strategies, L1–L3 support levels, documentation,\nchange management and common causes of project failure.'
  },
  {
    n: 12,
    title: 'Soft Skills',
    cover: 'assets/covers-en/cover12.jpg',
    desc: 'Skills that help systems analysts work effectively with people, tasks, and change.\nCommunication, conflict management, decomposition, cascading goals,\nSMART criteria, self-management, and professional development.'
  }
];

/* Строки интерфейса и тексты сцен. Разметка переносов — <br class="wide">:
   на узком экране такие переносы отключаются, как и в русской версии. */
window.CATALYST.text = {

  ru: {
    code: 'ru',
    issues: () => window.CATALYST.issues,
    hero: {
      h1:      'Эта серия — попытка собрать <br class="wide">разработку систем в понятную <br class="wide">и последовательную структуру.',
      h3:      'Без перегруженных <br class="wide">формулировок и упрощений.',
      softP:   'Только то, что помогает увидеть систему целиком, <br class="wide">а не как набор отдельных инструментов и процессов.',
      h2:      'Каждый номер рассматривает <br class="wide">отдельную часть работы аналитика.',
      midP:    'Вместе выпуски формируют целостное представление <br class="wide">о процессе создания и развития системы <br class="wide">— от идеи до внедрения и сопровождения.',
      countTxt:'выпусков посвящены <br class="wide">ключевым темам <br class="wide">системного анализа.',
      numP:    'Требования, проектирование, взаимодействие сервисов, <br class="wide">архитектура, данные, процесс разработки и интеграции.',
    },
    cta:  'Все выпуски',
    hint: 'прокрутите',
    rail: [
      { k: '12',          tag: '[ выпусков в серии ]' },
      { k: 'от идеи',     tag: '[ до внедрения и сопровождения ]' },
      { k: 'по порядку',  tag: '[ или с любого выпуска ]' }
    ],
    claim: {
      head: 'Для тех, кто хочет<br>видеть систему целиком',
      note: 'Серия подойдёт начинающим аналитикам, разработчикам, <br class="wide">студентам и тем, кто хочет структурировать практические <br class="wide">знания. Короткие главы, единая структура и последовательная <br class="wide">подача помогают не теряться в терминах и видеть связи между <br class="wide">частями системы.'
    },
    doors: {
      ru: { lang: 'Русская версия',  go: 'Перейти и скачать' },
      /* за этой дверью английские выпуски — подпись на английском
         в обеих версиях сайта */
      en: { lang: 'English edition', go: 'Open and download' }
    },
    aria: { issue: 'Выпуск', cover: 'Обложка выпуска',
            lang: 'Switch to English', theme: 'Переключить тему' },
    meta: { title: 'Catalyst — System Analysis Basic',
            desc:  'Серия из 12 цифровых журналов о системном анализе.' }
  },

  en: {
    code: 'en',
    issues: () => window.CATALYST.issuesEn,
    hero: {
      h1:      'This series is an attempt to bring <br class="wide">system development into a clear <br class="wide">and consistent structure.',
      h3:      'No unnecessary complexity <br class="wide">or oversimplification.',
      softP:   'Only what helps you see the system as a whole, <br class="wide">rather than as a collection of separate tools and processes.',
      h2:      'Each issue explores <br class="wide">a specific part of a systems analyst’s work.',
      midP:    'Together, the issues provide a complete view <br class="wide">of the system development lifecycle <br class="wide">— from an idea to implementation and support.',
      countTxt:'issues dedicated <br class="wide">to key topics <br class="wide">in systems analysis.',
      numP:    'Requirements, design, system interaction, <br class="wide">architecture, data, development and integration processes.',
    },
    cta:  'All issues',
    hint: 'scroll',
    rail: [
      { k: '12',        tag: '[ issues in the series ]' },
      { k: 'from an idea', tag: '[ to implementation and support ]' },
      { k: 'in order',  tag: '[ or start with any issue ]' }
    ],
    claim: {
      head: 'For those who want<br>to see the whole system',
      note: 'The series is designed for aspiring analysts, developers, students, <br class="wide">and anyone who wants to structure their practical knowledge. <br class="wide">Short chapters, a consistent structure, and a clear progression <br class="wide">help you navigate the terminology and see the connections <br class="wide">between different parts of a system.'
    },
    doors: {
      ru: { lang: 'Russian edition', go: 'Open and download' },
      en: { lang: 'English edition', go: 'Open and download' }
    },
    aria: { issue: 'Issue', cover: 'Cover of issue',
            lang: 'Переключить на русский', theme: 'Toggle theme' },
    meta: { title: 'Catalyst — System Analysis Basic',
            desc:  'A series of 12 digital magazines on systems analysis.' }
  }
};
