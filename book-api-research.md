# مصادر بيانات الكتب

## Open Library
الرابط الرسمي: https://openlibrary.org/developers/api
يوفر APIs عامة بصيغ JSON/YAML/RDF للبحث عن الكتب والمؤلفين والأعمال والطبعات والأغلفة. توثيق البحث: https://openlibrary.org/dev/docs/api/search

قيود مهمة حسب التوثيق: الخدمة مخصصة للاكتشاف البشري والطلبات منخفضة الحجم وليست قاعدة backend عالية المرور لتطبيقات تجارية كبيرة. يجب تخزين الاستجابات مؤقتًا، تعريف التطبيق عبر User-Agent ووسيلة تواصل، وعدم جمع البيانات بكميات ضخمة. حد الطلبات المذكور: طلب واحد/ثانية افتراضيًا، وقد يصل إلى 3 طلبات/ثانية للتطبيقات المعرّفة.

الأغلفة: https://openlibrary.org/dev/docs/api/covers
يمكن استخدام رابط مباشر مثل https://covers.openlibrary.org/b/isbn/9780261102217-M.jpg أو استخدام cover ID. التوثيق يطلب عرض الغلاف من covers.openlibrary.org وعدم زحف/تحميل الأغلفة بالجملة، مع تفضيل رابط رجوع إلى Open Library.

## Google Books
الرابط الرسمي: https://developers.google.com/books
توثيق Volume: https://developers.google.com/books/docs/v1/reference/volumes
يوفر العنوان، العنوان الفرعي، المؤلفين، الناشر، تاريخ النشر، الوصف، ISBN-10/ISBN-13، عدد الصفحات، التصنيفات، التقييم العام، عدد التقييمات، اللغة، imageLinks بأحجام متعددة، previewLink وinfoLink. البحث العام يتم عبر https://www.googleapis.com/books/v1/volumes?q=...

البيانات العامة تتطلب API key أو OAuth وفق التوثيق، والمفتاح يمكن تقييده من Google Cloud Console. في Agon يفضل إبقاء المفتاح في الخادم واستدعاء Google عبر tRPC، مع التخزين المؤقت.

## Library of Congress
الرابط الرسمي: https://www.loc.gov/apis/json-and-yaml/
يوفر JSON/YAML عامًا دون API key لمجموعات Library of Congress، لكنه لا يتضمن كامل سجلات فهرس المكتبة؛ يركز على العناصر والمواد الرقمية المتاحة عبر loc.gov، لذلك يصلح كمصدر إضافي للكتب التاريخية لا كمصدر الكتب الرئيسي.

## ISBNdb
الرابط الرسمي: https://isbndb.com/isbndb-api-documentation-v2
REST API مدفوع غالبًا ويتطلب Authorization header، مع endpoints للكتب والمؤلفين والناشرين والموضوعات. مناسب لاحقًا إذا احتاج التطبيق بيانات ISBN احترافية، لكنه ليس الخيار المجاني الأول.

## القرار الحالي
للتنفيذ السريع: Open Library عبر مسار خادمي عام بلا مفتاح، مع بحث افتراضي صالح (q=the) وتصفح صفحات متتابعة، ثم بطاقات غلاف وتفاصيل ومراجعات. قاعدة البيانات الحالية تستخدم mediaId رقميًا، لذلك يحول bookKey النصي إلى hash رقمي مستقر للمراجعات، مع الاحتفاظ bookKey في بيانات النتائج. Google Books يمكن إضافته لاحقًا كمصدر إثراء أو بديل عند الحاجة لمعلومات وصفية أوسع.
