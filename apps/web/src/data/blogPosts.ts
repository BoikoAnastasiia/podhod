import type { Localized } from "./programTemplates.js";

export type BlogPost = {
  /** Slug is the URL and the stable key; never shown as text. */
  slug: string;
  title: Localized;
  excerpt: Localized;
  /** ISO date, rendered with toLocaleDateString in the visitor's language. */
  date: string;
  /**
   * Self-hosted under public/blog/ — never hotlinked, per the project's
   * no-third-party-requests stance. creditUrl links the source (Unsplash
   * licence: credit appreciated, hotlinking not required).
   */
  image?: { src: string; creditUrl: string };
  paragraphs: Localized[];
};

/**
 * Three starter articles — the owner's word was "fillers", but they are
 * honest fillers: real training topics, written to be replaced by real
 * posts rather than lorem ipsum that would make the section look broken.
 * Static data like the templates: no CMS, no backend, replaceable by
 * editing this file.
 */
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-progression-works",
    title: {
      en: "How progression schemes actually work",
      ru: "Как на самом деле работают схемы прогрессии",
    },
    excerpt: {
      en: "Linear, double progression, RPE — what the four schemes in PODHOD mean and when each one earns its place.",
      ru: "Линейная, двойная прогрессия, RPE — что означают четыре схемы в PODHOD и когда какая уместна.",
    },
    date: "2026-08-01",
    image: {
      src: "/blog/how-progression-works.jpg",
      creditUrl:
        "https://unsplash.com/photos/detailed-anatomical-model-showing-human-back-muscles-and-skeletal-structure-FtQ7Hs6c5Lk",
    },
    paragraphs: [
      {
        en: "Getting stronger is not about doing more every day — it is about a rule that decides when to add weight and when to hold. That rule is what PODHOD calls a progression scheme, and every exercise in a program carries one.",
        ru: "Стать сильнее — не значит делать больше каждый день. Это правило, которое решает, когда добавить вес, а когда подождать. Такое правило в PODHOD называется схемой прогрессии, и она есть у каждого упражнения в программе.",
      },
      {
        en: "Linear progression is the classic: hit your sets and reps, add 2.5 kg next time. Miss three sessions in a row, take ten percent off and rebuild. It works spectacularly well for the first months of barbell training.",
        ru: "Линейная прогрессия — классика: выполнили все подходы и повторения — в следующий раз плюс 2,5 кг. Три неудачи подряд — минус десять процентов и заново. Первые месяцы работы со штангой она даёт поразительный результат.",
      },
      {
        en: "Double progression moves along two axes: first you grow reps inside a range, say 8 to 12, and only when the top of the range falls do you add weight and drop back to 8. Slower, gentler, ideal for accessories and machines.",
        ru: "Двойная прогрессия движется по двум осям: сначала растут повторения в диапазоне, например от 8 до 12, и только когда покорилась верхняя граница — добавляется вес, а повторения возвращаются к 8. Медленнее, мягче, идеально для подсобки и тренажёров.",
      },
      {
        en: "RPE-based work self-regulates: you aim at a feeling of effort — 8 out of 10 means two reps left in the tank — and the weight adjusts to the day you are actually having, not the day the spreadsheet assumed.",
        ru: "Работа по RPE саморегулируется: вы целитесь в ощущение усилия — 8 из 10 значит «в запасе два повторения» — и вес подстраивается под день, который у вас есть на самом деле, а не под день из таблицы.",
      },
      {
        en: "And sometimes a fixed prescription is right — a kettlebell only comes in one size at a time. PODHOD lets every exercise pick its own rule, which is exactly how a good coach writes a sheet.",
        ru: "А иногда правильный выбор — фиксированная схема: гиря бывает только одного веса за раз. В приложении PODHOD каждое упражнение выбирает своё правило — именно так хороший тренер и пишет программу.",
      },
    ],
  },
  {
    slug: "first-working-weight",
    title: {
      en: "Choosing your first working weight",
      ru: "Как выбрать первый рабочий вес",
    },
    excerpt: {
      en: "Start lighter than your ego wants. Here is a simple way to find a weight that leaves room to grow.",
      ru: "Начните легче, чем хочет ваше эго. Простой способ найти вес, с которого есть куда расти.",
    },
    date: "2026-08-05",
    paragraphs: [
      {
        en: "The most common beginner mistake is starting where you think you should be, not where you are. The first working weight is not a test — it is a starting line, and the whole point of a progression scheme is that the line moves.",
        ru: "Самая частая ошибка новичка — начинать там, где «должен быть», а не там, где есть. Первый рабочий вес — не экзамен, а стартовая черта, и весь смысл схемы прогрессии в том, что черта сдвигается.",
      },
      {
        en: "A practical method: pick a weight you are certain you can lift for ten clean reps. Do your sets with it. If the last set felt like a 6 out of 10, add the smallest step your gym allows next time. That is the entire trick.",
        ru: "Практичный способ: возьмите вес, который вы точно поднимете на десять чистых повторений. Сделайте с ним все подходы. Если последний ощущался на 6 из 10 — в следующий раз добавьте самый маленький шаг, какой позволяет зал. Вот и весь секрет.",
      },
      {
        en: "Light starts pay compound interest: your joints adapt, your technique gets rehearsed under easy loads, and the scheme adds weight faster than you would dare to on your own — without ever skipping a step.",
        ru: "Лёгкий старт платит сложные проценты: суставы адаптируются, техника репетируется на простых весах, а схема добавляет нагрузку быстрее, чем вы решились бы сами — не пропуская ни одной ступеньки.",
      },
      {
        en: "In PODHOD a new exercise arrives as 4 sets of 10 at a modest default — change the weight right on the row, and let the scheme take it from there.",
        ru: "В приложении PODHOD новое упражнение появляется как 4 подхода по 10 с умеренным весом по умолчанию — поменяйте вес прямо в строке, а дальше пусть работает схема.",
      },
    ],
  },
  {
    slug: "full-body-or-split",
    title: {
      en: "Full body or a split — which program shape fits you?",
      ru: "Фулбоди или сплит — какая форма программы вам подходит?",
    },
    excerpt: {
      en: "Two or three workouts a week point one way; five point another. A short guide to picking a shape you will actually keep.",
      ru: "Два-три посещения зала в неделю — одна дорога; пять — другая. Короткий гид, как выбрать форму, которой вы будете придерживаться.",
    },
    date: "2026-08-08",
    paragraphs: [
      {
        en: "The best program shape is the one that survives your calendar. Train twice or three times a week and full-body workouts win: every session touches everything, so a missed day never orphans a muscle group.",
        ru: "Лучшая форма программы — та, что переживает ваш календарь. Тренируетесь два-три раза в неделю — выигрывает фулбоди: каждая сессия задевает всё, и пропущенный день не оставляет мышечную группу сиротой.",
      },
      {
        en: "Four days or more and a split starts to make sense — upper/lower being the most forgiving: each half still gets trained twice a week, and the sessions stay short enough to finish.",
        ru: "Четыре дня и больше — начинает работать сплит, и «верх/низ» — самый щадящий вариант: каждая половина тела всё ещё тренируется дважды в неделю, а сессии остаются достаточно короткими.",
      },
      {
        en: "In PODHOD a program is one workout, the way a coach writes one sheet per day — so your week is just the set of programs you keep: 'monday', 'leg day', whatever your calendar actually looks like.",
        ru: "В приложении PODHOD программа — это одна тренировка, как один лист от тренера на день. Ваша неделя — просто набор программ: «понедельник», «день ног» — как на самом деле выглядит ваш календарь.",
      },
      {
        en: "Start from a ready-made workout, swap what your gym cannot support, and let consistency — not ambition — pick the shape.",
        ru: "Начните с готовой тренировки, замените то, чего нет в вашем зале, и пусть форму выбирает регулярность, а не амбиции.",
      },
    ],
  },
];
