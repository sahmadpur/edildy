/** The FAQ page under Digər (feedback 2026-11-14): short answers to what users ask most. */
export default {
  title: 'Tez-tez verilən suallar',
  intro: 'Veb və mobil tətbiq haqqında ən çox verilən suallar. Cavab tapmadınızsa, Edildy dəstəyinə yazın.',
  items: {
    offline: {
      q: 'İnternet olmayanda işçi yoxlamanı apara bilər?',
      a: 'Bəli. Telefona əvvəlcədən yüklənmiş yoxlamalar internetsiz tam aparılır; cavablar, foto və videolar telefonda saxlanılır və əlaqə yaranan kimi göndərilir. Yeni yoxlamalar və tapşırıqlar isə yalnız internetlə yüklənir, ona görə işçi günə internetlə başlamalıdır.',
    },
    workerLogin: {
      q: 'İşçilər mobil tətbiqə necə daxil olur?',
      a: 'Təşkilatın kodu, login və PIN ilə. E-poçt və ya telefon nömrəsi tələb olunmur.',
    },
    pin: {
      q: 'İşçi PIN-i unudub. Nə etməli?',
      a: 'Əməkdaşlar → əməkdaşın kartı → «PIN/şifrəni sıfırla». Yeni PIN yalnız bir dəfə göstərilir; onu işçiyə çatdırın.',
    },
    password: {
      q: 'Veb tətbiqin şifrəsini unutmuşam.',
      a: 'Giriş səhifəsində «Şifrəni unutmusunuz?» keçidinə basın — bərpa keçidi e-poçtunuza gələcək. Admin də əməkdaşın kartından bərpa keçidi göndərə bilər.',
    },
    branches: {
      q: 'Filial, zona və bölmə nədir?',
      a: 'Filial təşkilatın ayrıca ünvanıdır (hər təşkilatın ən azı bir filialı var). Filialın içində zonalar, zonaların içində bölmələr yaradılır. Onları «Filiallar» səhifəsində əlavə edin; yoxlamanı təyin edərkən filialı, sonra zona və ya bölməni seçirsiniz.',
    },
    severalTimes: {
      q: 'Bir yoxlamanı gündə bir neçə dəfə necə təyin edim?',
      a: 'Yeni təyinatda «Sabit vaxt» seçin və «Vaxt əlavə et» ilə lazımi saatları əlavə edin (məsələn, 08:00, 13:00, 18:00) — hər vaxt ayrıca yoxlamadır. Bərabər aralıqla təkrar üçün (məsələn, hər saat 08:00–20:00) «Gün ərzində təkrar» seçin.',
    },
    takenByOther: {
      q: 'Telefonda «Bu yoxlamanı başqa əməkdaş aparır» yazılır.',
      a: 'Yoxlama bir neçə icraçıya təyin olunub və onu başqası artıq başladıb. İnternetsiz başlanmış yoxlama göndəriləndə də server bu səbəblə onu qəbul etməyə bilər; cavablar itmir, amma nəticəyə sayılmır.',
    },
    clock: {
      q: '«Telefonun saatı serverdən fərqlənir» xəbərdarlığı çıxır.',
      a: 'Telefonun ayarlarında tarix və vaxtı avtomatik rejimə qoyun. Fərq 5 dəqiqədən çox olanda yoxlama «saat şübhəli» kimi işarələnir.',
    },
    update: {
      q: '«Tətbiqi yeniləyin» yazılır.',
      a: 'Yoxlama vərəqəsi tətbiqin daha yeni versiyasını tələb edir. Tətbiqi App Store və ya Google Play-dən yeniləyin.',
    },
    partial: {
      q: 'Yoxlama «Yarımçıq» oldu. Davam etmək olar?',
      a: 'Xeyr. Yoxlamanın vaxtı bitəndə yarımçıq qalan yoxlama kilidlənir. Gələcək yoxlamalar üçün təyinatda icra müddətini artırın.',
    },
    versions: {
      q: 'Dərc olunmuş vərəqədə sualı dəyişsəm, köhnə nəticələr pozulur?',
      a: 'Xeyr. Hər dərc yeni versiyadır; keçirilmiş yoxlamalar öz versiyası ilə saxlanılır.',
    },
    media: {
      q: 'Foto və videolar harada saxlanılır?',
      a: 'Təşkilatınızın ayrıca yaddaşında. Onlara yalnız icazəsi olan əməkdaşlar, vaxtla məhdud keçidlərlə baxır.',
    },
    scope: {
      q: 'Menecer niyə bəzi filialları görmür?',
      a: 'Menecer yalnız ona aid filialları və onların zona və bölmələrini görür. Əməkdaşlar → menecerin kartı → filialları seçin.',
    },
    languages: {
      q: 'Hansı dillər var?',
      a: 'Azərbaycan, ingilis və rus dilləri — həm vebdə, həm mobil tətbiqdə. Hər əməkdaş dili özü seçir.',
    },
  },
} as const;
