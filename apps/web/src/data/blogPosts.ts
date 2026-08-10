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
   * no-third-party-requests stance. `credit` is the photographer's name and
   * creditUrl the source page (Unsplash licence: credit appreciated).
   */
  image?: { src: string; credit: string; creditUrl: string };
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
      credit: "Brecht Corbeel",
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
    image: {
      src: "/blog/first-working-weight.jpg",
      credit: "Victor Freitas",
      creditUrl: "https://unsplash.com/photos/person-about-to-lift-the-barbel-WvDYdXDzkhs",
    },
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
    image: {
      src: "/blog/full-body-or-split.jpg",
      credit: "Alora Griffiths",
      creditUrl: "https://unsplash.com/photos/pair-of-black-dumbbells-zEAX0E0KJxs",
    },
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
  {
    slug: "protein-for-more-than-muscle",
    title: {
      en: "Protein: not just for muscle",
      ru: "Белок: не только для мышц",
    },
    excerpt: {
      en: "Hair, skin and recovery all run on protein — and a chicken breast covers it as well as any powder.",
      ru: "Волосы, кожа и восстановление — всё это работает на белке, и куриная грудка справляется не хуже любого порошка.",
    },
    date: "2026-08-10",
    image: {
      src: "/blog/protein-for-more-than-muscle.jpg",
      credit: "Ella Olsson",
      creditUrl: "https://unsplash.com/photos/broccoli-with-meat-on-plate-mmnKI8kMxpc",
    },
    paragraphs: [
      {
        en: "Protein has a gym-bro reputation, but muscle is only one of its customers. Hair is mostly keratin and skin leans on collagen — both proteins your body rebuilds continuously from what you eat. Run a deficit for long enough and it shows up far from the squat rack: brittle hair, dull skin, slower recovery from everything.",
        ru: "У белка репутация еды качков, но мышцы — лишь один из его потребителей. Волосы — это в основном кератин, кожа держится на коллагене, и оба этих белка тело непрерывно строит из того, что вы едите. Затянувшийся дефицит проявляется далеко от стойки для приседа: ломкие волосы, тусклая кожа, медленное восстановление после чего угодно.",
      },
      {
        en: "For someone who trains, the commonly cited range is roughly 1.6–2.2 grams per kilogram of body weight per day. You do not need to hit it with a calculator — you need most meals to contain something that was recently an animal, a fish, an egg or a bean.",
        ru: "Для тренирующегося человека обычно называют диапазон примерно 1,6–2,2 грамма на килограмм веса в день. Считать с калькулятором не обязательно — достаточно, чтобы в большинстве приёмов пищи было что-то, что недавно было мясом, рыбой, яйцом или фасолью.",
      },
      {
        en: "Protein powder is a convenience, not a requirement. The easiest whole-food source is the unglamorous chicken breast: about 30 grams of protein per 100 grams cooked, cheap, and it survives any cooking skill level. Eggs, cottage cheese, fish and legumes fill in the rest of the week.",
        ru: "Протеиновый порошок — удобство, а не необходимость. Самый простой цельный источник — негламурная куриная грудка: около 30 граммов белка на 100 граммов готового продукта, дёшево, и она переживает любой уровень кулинарных навыков. Яйца, творог, рыба и бобовые закрывают остальную неделю.",
      },
      {
        en: "The practical rule: lift, eat enough protein, sleep — in that order of glamour and the reverse order of importance. The progression scheme moves the bar; the plate is what lets your body keep up with it.",
        ru: "Практичное правило: тренируйтесь, ешьте достаточно белка, спите — в этом порядке по зрелищности и в обратном по важности. Схема прогрессии двигает штангу; тарелка — то, что позволяет телу за ней успевать.",
      },
    ],
  },
];
