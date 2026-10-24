// The word lists the typesetter's rules use (core.js). Lower case; a list is checked against a word in lower case.
const set = (s) => new Set(s.trim().split(/\s+/));

export const RU = {
  // words of three letters or more that stay with the word AFTER them, like the short ones («без уточнений»)
  short3: set("без для над под при про обо изо ото что как или меж ибо"),
  // particles: stay with the word BEFORE them («сделал бы», «так ли»)
  particles: set("же ли бы ж б"),
  // prepositions written with a hyphen: they stay with the word after them like the short ones («из-за⍽этого»)
  compoundPreps: set("из-за из-под по-над по-за"),
  // the endings of «кто-то», «дай-ка», «как-нибудь», and «кое-»: the hyphen of these never ends a line
  hyphenParts: set("то ка либо нибудь кое таки де"),
  // a number stays with these after it: units, «год», months, «тыс.», «млн»… (not «т» and «с»: «2025 т. е.», «5 с
  // лишним»; one-letter ones only with their dot)
  units: set(`
    км м см мм мкм кг г мг ц л мл га ч мин сек мс нс
    б кб мб гб тб кбит мбит гбит пикс пт px dpi
    руб р коп тыс млн млрд трлн шт ед чел экз
    г гг в вв век века веке веков год года году годом годах годы годов лет
    января февраля марта апреля мая июня июля августа сентября октября ноября декабря
    январь февраль март апрель май июнь июль август сентябрь октябрь ноябрь декабрь
    янв фев мар апр июн июл авг сен сент окт ноя нояб дек`),
  // these stay with the number AFTER them: «ст.⍽6», «п.⍽5», «глава⍽3», «параграфе⍽3»
  labels: set(`
    ст п пп ч гл рис табл с стр т вып кв д корп оф эт пр ул инн огрн огрнип кпп бик окпо
    статья статьи статье статью статей пункт пункта пункте пунктом пункты пунктов подпункт подпункта подпункте
    часть части частью глава главы главе главу параграф параграфа параграфе параграфом раздел раздела разделе
    рисунок рисунка рисунке таблица таблицы таблице приложение приложения приложении том тома томе
    цель цели целью шаг шага этап этапа номер`),
  // a place before its name: «г.⍽Москва», «ул.⍽Тверская»
  places: set("г ул пр пл пер просп бул ш наб обл р-н пос с дер"),
  // abbreviations that point at what follows them: «см.⍽раздел 3», «напр.⍽так»
  pointers: set("см ср напр"),
  // forms of a business and a person's title before a name: «ООО⍽„Ромашка“», «ИП⍽Поплавский»
  orgs: set("ооо оао зао пао ао нко ип фгуп гуп муп тоо"),
  // «т.⍽е.», «т.⍽д.», «и⍽т.⍽п.», «и⍽др.»: the second word of these joins the first
  pairs: { т: set("е д п к ч"), в: set("т") },
};

export const EN = {
  // stay with the word AFTER them in any text
  short: set("a an the"),
  // in headings these stay with the word after them too (a heading has few places to break, and a line that ends
  // in «of» or «to» reads as unfinished)
  headingShort: set("of to in on at by for and or nor but as if is it so up via per vs is am are was be my our its"),
  // titles before a name: «Dr.⍽Smith»
  honorifics: set("mr mrs ms mx dr prof st sgt capt lt col gen rev hon sen rep gov pres fr sr"),
  // after a name: «Smith,⍽Jr.»
  suffixes: set("jr sr ii iii iv esq phd md"),
  // these stay with the number after them: «Fig.⍽3», «page⍽12», «No.⍽5»
  labels: set(`
    no nos fig figs ex vol vols p pp ch art sec eq ed pt
    page pages chapter chapters figure figures table tables section sections part parts step steps
    volume issue item items line lines article clause appendix grade level room suite unit version`),
  // a number stays with these after it
  units: set(`
    km m cm mm µm nm kg g mg lb lbs oz ft yd mi mph kph l ml h hr hrs min s sec ms µs ns
    hz khz mhz ghz b kb mb gb tb pb kbps mbps gbps px pt em rem dpi ppi k bn mn
    am pm a.m p.m bc bce ce ad usd eur gbp rub
    percent pc pcs
    january february march april may june july august september october november december
    jan feb mar apr jun jul aug sep sept oct nov dec`),
  // a month stays with the number after it: «October⍽19», «Oct.⍽19»
  months: set(`
    january february march april may june july august september october november december
    jan feb mar apr jun jul aug sep sept oct nov dec`),
};

// the words that, after a number, are not what the number counts («in 2026 the market…»)
export const FUNCTION = new Set([...RU.short3, ...RU.particles, ...EN.short, ...EN.headingShort]);
