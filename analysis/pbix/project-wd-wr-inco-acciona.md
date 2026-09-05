# Таблица `Project WD+WR+INCO+Acciona` («PR all»)

Разбор одной таблицы семантической модели Power BI из
`sources/1. ALL SUBCON … Weld Progress +( Full Scope ).pbix`.
Всё, что ниже, прочитано из `analysis/pbix/raw/model/*.json` и
`analysis/pbix/raw/visuals-flat.json`; DAX и M приведены дословно, ничего не пересказано.
Машиночитаемая версия таблицы колонок — `analysis/pbix/raw/prall-columns.json` (425 записей).

| факт | значение | источник |
|---|---|---|
| строк | **6 546 261** | `row-counts.json` |
| колонок | **425** = 267 импортированных + 158 вычисляемых (DAX) | `columns.json` (`Type` 1 / 2) |
| мер, привязанных к таблице | **240** (200 ссылаются на неё в DAX, 171 несут `"PR all"` в имени, 131 — и то и другое) | `measures.json` |
| визуалов | **1 107** из 2 285 на **107** страницах из 144, **171** различное поле | `visuals-flat.json` |
| связей | 3 (одна исходящая M:M, одна входящая активная 1:1, одна входящая неактивная 1:1) | `relationships.json` |
| дата «замороженного» refresh | **2026-08-30 11:03 UTC** (max `ModifiedTime` статистик колонок этой таблицы) | `column-statistics.json` |
| последняя дата сварки в данных | **2026-08-28** (M явно выкидывает 29 и 30 августа) | M + `analysis/sources2/profile.md` |

Проверка сложения: `uv run` по `columns.json` даёт `Counter({1: 267, 2: 158})`, сумма 425 — см. §Проверки.

---

## 1. Назначение и происхождение

### 1.1 Что это такое

Это **главная факт-таблица проектного уровня**: объединение сварочных данных **всех**
субподрядчиков в один плоский ряд одинаковой формы. Меры, построенные на ней, несут суффикс
`"PR all"` (project-all) — в отличие от `"EP"`/`"WD"` (только `Weld Dump` = GAC/TEKFEN/MEDGULF)
и мёртвого `"PR"` (`Project WD+WR`, отфильтрован до одного стыка, ruling R-06).

`Sub-Contractor` в таблице имеет **6 различных значений** (cardinality 6): CCC, GAC, TEKFEN,
MEDGULF, Acciona, Inco. Из них CCC не существует в `Weld Dump.txt` вовсе — он приходит только
из `CSVExport_Welder Record` (см. `analysis/calculation-logic.md` §1.1).

### 1.2 M-родословная: не четыре источника, а пять

> **Расхождение с предыдущим отчётом.** `analysis/pbix/model.md` и `calculation-logic.md` §0.3
> описывают «PR all» как `Table.Combine({Weld Dump, CSVExport_Welder Record, Acciona_Query,
> Inco Weld Log})`. Это первый `Table.Combine`. В том же запросе есть **второй**:
> `#"Appended Query" = Table.Combine({#"Changed Type2", #"AllTrain_CSVExport_Joint Record NOT WELDED"})`.
> Пятый источник — 130 994 строки **несваренных** стыков CCC. Без него арифметика строк не сходится
> (см. §1.4), а меры «Total Scope» (весь объём работ, а не только сваренное) недосчитывают
> 130 994 стыка CCC.

Порядок сборки, снизу вверх:

```
Weld Dump.txt (226 полей, ";", cp1252, 1 002 373 строк)
  └─ Weld Dump                       958 634   ← 70 шагов M: drop Column221, promote headers,
                                                  Area Classification <> 0/"", Revision Status = "",
                                                  NA→"" в 6 датах, RT Weld Status T1-2→T1,
                                                  Weld Type BW_→BW / SW_→SW,
                                                  Manual UT Status ACCEPT/ACEPT→A, REJECT→R,
                                                  Result (A/R) ACCEPT→A,
                                                  drop Weld Date ∈ {2026-12-30, 2026-08-29, 2026-08-30},
                                                  + Spool ID, + Joint ID, + RT Film Total, + HT Remarks,
                                                  + 6 ПУСТЫХ колонок-заглушек для стыковки с CCC:
                                                    RT/UT, NDT Remarks, Tracer Shot,
                                                    Weld Point Code, Original Joint, Repair Suffix

CSVExport_Welder Record.csv (119 полей, ",", utf-8, 5 430 732 строк)
  └─ CSVExport_Welder Record       5 433 009   ← 126 шагов M:
       SelectRows [RT/UT Report No.] = ""      (строки БЕЗ RT-отчёта)
       Table.Combine с CSVExport_Welder Record - (ACC  REJ )   (641 575 строк С RT-отчётом,
                                                                из отдельного .xlsx)
       RemoveColumns 78 шт., 10 × RenameColumns (22 переименования, см. §1.5),
       ~40 × AddColumn(… each "") — заглушки под форму Weld Dump,
       Repair Suffix R01→R1, R02→R2,
       + Joint ID = ISO & "-" & Spool & "-" & Weld & Repair Suffix,
       + Spool ID,
       Table.ReplaceValue(Custom1, "#", "CCC", Replacer.ReplaceText, {"Sub-Contractor"}),
       drop Weld Date ∈ {2026-08-29, 2026-08-30}

Acciona_Latest Add to Query.xlsx
  └─ Acciona_Query                    13 313   ← 205 шагов M; AddColumn "Sub-Contractor" = "Acciona";
                                                  + Joint ID = ISO & "-" & Spool & "-" & Weld
                                                    (БЕЗ Repair Suffix), + Spool ID

Inco/Master Weld_Latest.xlsx
  └─ Inco Weld Log                    10 327   ← 221 шаг M; AddColumn "Sub-Contractor" = "Inco";
                                                  Joint ID = переименованный "joint with tank",
                                                  Spool ID = литерал "-", ISO Number = "Tank No"

AllTrain_CSVExport_Joint Record.csv (143 поля)
  └─ AllTrain_CSVExport_Joint
       Record NOT WELDED            130 994   ← 191 шаг M; SelectRows [Del Flag] = "";
                                                  SelectRows [Weld Date] = null  ← несваренные;
                                                  Repair Suffix R01→R1/R02→R2, + Joint ID, + Spool ID,
                                                  ~120 × AddColumn(… each "")
```

### 1.3 Сам запрос — verbatim

```m
let
    Source = Table.Combine({#"Weld Dump", #"CSVExport_Welder Record", Acciona_Query, #"Inco Weld Log"}),
    #"Changed Type" = Table.TransformColumnTypes(Source,{{"RT%", Int64.Type}, {"UT%", Int64.Type}, {"MT%", Int64.Type}, {"PMI%", Int64.Type}, {"PT%", Int64.Type}, {"Weld Cat", type text}, {"RT Re-Shoot Films", Int64.Type}}),
    #"Changed Type3" = Table.TransformColumnTypes(#"Changed Type",{{"Joint ID", type text}}),
    #"Filtered Rows SubCon" = Table.SelectRows(#"Changed Type3", each ([#"Sub-Contractor"] <> "")),
    #"Replaced Value" = Table.ReplaceValue(#"Filtered Rows SubCon",null,"",Replacer.ReplaceValue,{"Weld Cat"}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Replaced Value",{{"Total No of films Acc", type number}, {"WeldPoint No.", Int64.Type}, {"Dia inch", type number}}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Changed Type1",{{"Total No of films Rej", type number}}),
    #"Appended Query" = Table.Combine({#"Changed Type2", #"AllTrain_CSVExport_Joint Record NOT WELDED"}),
    #"Changed Type4" = Table.TransformColumnTypes(#"Appended Query",{{"HT%", Int64.Type}, {"FN%", Int64.Type}, {"RT Re-Shoot Films", Int64.Type}}),
    #"Replaced Value1" = Table.ReplaceValue(#"Changed Type4","ACCEPT","A",Replacer.ReplaceText,{"Manual UT Status"}),
    #"Replaced Value2" = Table.ReplaceValue(#"Replaced Value1","ACEPT","A",Replacer.ReplaceText,{"Manual UT Status"}),
    #"Replaced Value3" = Table.ReplaceValue(#"Replaced Value2","REJECT","R",Replacer.ReplaceText,{"Manual UT Status"}),
    #"Replaced RPDS to RPD" = Table.ReplaceValue(#"Replaced Value3","RPDS","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDUA to RPD" = Table.ReplaceValue(#"Replaced RPDS to RPD","RPDUA","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPD0 to RPD" = Table.ReplaceValue(#"Replaced RPDUA to RPD","RPD0","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDF to RPD" = Table.ReplaceValue(#"Replaced RPD0 to RPD","RPDF","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDN to RPD" = Table.ReplaceValue(#"Replaced RPDF to RPD","RPDN","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDNA to RPD" = Table.ReplaceValue(#"Replaced RPDN to RPD","RPDNA","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDSA to RPD" = Table.ReplaceValue(#"Replaced RPDNA to RPD","RPDSA","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDHA to RPD" = Table.ReplaceValue(#"Replaced RPDSA to RPD","RPDHA","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDA to RPD" = Table.ReplaceValue(#"Replaced RPDHA to RPD","RPDA","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOB0 to SOB" = Table.ReplaceValue(#"Replaced RPDA to RPD","SOB0","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBF to SOB" = Table.ReplaceValue(#"Replaced SOB0 to SOB","SOBF","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBHA to SOB" = Table.ReplaceValue(#"Replaced SOBF to SOB","SOBHA","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBN to SOB" = Table.ReplaceValue(#"Replaced SOBHA to SOB","SOBN","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBS to SOB" = Table.ReplaceValue(#"Replaced SOBN to SOB","SOBS","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBSA to SOB" = Table.ReplaceValue(#"Replaced SOBS to SOB","SOBSA","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBUA to SOB" = Table.ReplaceValue(#"Replaced SOBSA to SOB","SOBUA","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBA to SOB" = Table.ReplaceValue(#"Replaced SOBUA to SOB","SOBA","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"ACCEPT to A" = Table.ReplaceValue(#"Replaced SOBA to SOB","ACCEPT","A",Replacer.ReplaceText,{"Result (A/R)"}),
    #"Joint ID for Heat N" = Table.AddColumn(#"ACCEPT to A", "Joint ID for Heat N", each [ISO Number]&"-"&[#"Weld No."]&""&[Repair Suffix]),
    #"EXLUDE 4 RT B.log CCC" = Table.SelectRows(#"Joint ID for Heat N", each [Joint ID] <> "11040A1-DG6204061C-SP2-9" and [Joint ID] <> "11040A3-DB6204507-SP4-12" and [Joint ID] <> "11040A3-NG6204709-SP17-62" and [Joint ID] <> "11060A4-PR6206008-SP3-11"),
    #"Added Index" = Table.AddIndexColumn(#"EXLUDE 4 RT B.log CCC", "Index", 1, 1, Int64.Type)
in
    #"Added Index"
```

Всего 33 шага. Что здесь делается:

1. **`Table.Combine` №1** — union четырёх таблиц (WD + WR + Acciona + Inco).
2. **`Table.TransformColumnTypes` ×3** — `RT%/UT%/MT%/PMI%/PT%/RT Re-Shoot Films` → Int64,
   `Weld Cat` → text, `Joint ID` → text, `Total No of films Acc/Rej` → number,
   `WeldPoint No.` → Int64, `Dia inch` → number. Типизация **после** union — потому что
   у источников поля приходят разными типами.
3. **`Table.SelectRows … [Sub-Contractor] <> ""`** — единственный фильтр строк на этом шаге.
   Практически он ничего не удаляет: в `Weld Dump.txt` `Sub-Contractor` заполнен в 100 %
   строк (`analysis/dump/profile.md` §200), в `CSVExport_Welder Record.csv` — `Sub-Con Code`
   = `CCC` во всех 5 430 732 строках (`analysis/sources2/profile.md`), а Acciona и Inco
   получают литеральную константу через `AddColumn`. Это защитный фильтр, а не бизнес-правило.
4. **`Table.ReplaceValue(null → "")`** в `Weld Cat` — чтобы `Weld Cat` был текстом, а не BLANK.
5. **`Table.Combine` №2** — присоединяются 130 994 несваренных стыка CCC.
   Важно: этот append идёт **после** фильтра `Sub-Contractor <> ""`, то есть на несваренные
   строки фильтр не действует (у них `Sub-Contractor` — константа, cardinality 1, так что
   практической разницы нет).
6. **`ReplaceValue` ×3 по `Manual UT Status`**: `ACCEPT`→`A`, `ACEPT`→`A`, `REJECT`→`R`.
   Это **повтор** нормализации, которую `Weld Dump` уже сделал у себя, — здесь она нужна для
   строк Acciona/Inco/CCC.
7. **`ReplaceValue` ×17 по `Weld Type`**: схлопывание вариантов
   `RPDS/RPDUA/RPD0/RPDF/RPDN/RPDNA/RPDSA/RPDHA/RPDA → RPD` и
   `SOB0/SOBF/SOBHA/SOBN/SOBS/SOBSA/SOBUA/SOBA → SOB`.
   Это **`Replacer.ReplaceText`, а не `ReplaceValue`** — то есть подстрочная замена.
   Порядок значим: `RPDS` заменяется раньше `RPDSA`, поэтому `RPDSA` к моменту своего шага
   уже стал `RPDA` и повторно превращается в `RPD` на шаге `#"Replaced RPDA to RPD"`.
   Результат тот же, но воспроизводить надо именно как последовательность.
8. **`ACCEPT` → `A` в `Result (A/R)`**.
9. **`AddColumn "Joint ID for Heat N"`** = `ISO Number & "-" & Weld No. & Repair Suffix`
   (без `Spool No.`) — ключ для сверки по номеру плавки. 2 390 974 различных значения против
   2 390 991 у `Joint ID`.
10. **`SelectRows` — «EXLUDE 4 RT B.log CCC»**: жёстко зашитое исключение четырёх `Joint ID`:
    `11040A1-DG6204061C-SP2-9`, `11040A3-DB6204507-SP4-12`, `11040A3-NG6204709-SP17-62`,
    `11060A4-PR6206008-SP3-11`. Ручная правка данных «чтобы бэклог сошёлся».
11. **`Table.AddIndexColumn "Index"`** — 1..6 546 261, шаг 1. Это суррогатный ключ, по нему
    построены **обе** входящие связи (`TALISMAN DATA` и `Flange Progress`). Индекс зависит от
    порядка строк, то есть связи ломаются при любом изменении порядка источников — хрупкая
    конструкция, которую в Postgres надо заменить настоящим ключом.

Замечание: в этом запросе **нет** `RenameColumns` — все переименования сделаны в
запросах-источниках (см. §1.5).

### 1.4 Арифметика строк

| источник | строк (`row-counts.json`) |
|---|---:|
| `Weld Dump` | 958 634 |
| `CSVExport_Welder Record` (уже включает 641 575 строк из `- (ACC REJ )`) | 5 433 009 |
| `Acciona_Query` | 13 313 |
| `Inco Weld Log` | 10 327 |
| **подытог после `Table.Combine` №1** | **6 415 283** |
| `AllTrain_CSVExport_Joint Record NOT WELDED` | 130 994 |
| **подытог после `Table.Combine` №2** | **6 546 277** |
| минус `Sub-Contractor <> ""` | 0 (см. §1.3 п.3) |
| минус «EXLUDE 4 RT B.log CCC» | **−16** |
| **итого в модели** | **6 546 261** ✓ |

Расхождение ровно 16 строк на 4 исключённых `Joint ID` — по 4 строки на стык, что согласуется
с гранулярностью «одна строка = один weld point / один проход сварщика». Сходится точно.

Единственная неувязка в самих метаданных: `relationships.json` для обеих связей по `Index`
пишет `ToKeyCount = 6 546 264` — на 3 больше, чем `RowCount`. Это устаревшая статистика
кардинальности, а не данные; `Index` имеет cardinality ровно 6 546 261 в
`column-statistics.json`. Считать надо по `row-counts.json`.

### 1.5 Гармонизация колонок

Все переименования выполняются в `CSVExport_Welder Record` (22 шт., дословно перечислены в
`analysis/calculation-logic.md` §1.3 — не дублирую), плюс:

* **`"#"` → `"CCC"`**: `Table.ReplaceValue(Custom1,"#","CCC",Replacer.ReplaceText,{"Sub-Contractor"})`.
  В `CSVExport_Welder Record.csv` колонка `Sub-Con Code` содержит… на самом деле уже `CCC`
  во всех 5 430 732 строках (по профилю `analysis/sources2/profile.md`), а `#` лежит в
  `Original Joint` (5 389 971 строка). То есть в **текущем** файле эта замена — no-op,
  но в исходном экспорте код субподрядчика был `#`. Воспроизводить как
  `replace(sub_con_code, '#', 'CCC')` — безопасно в обоих случаях.
* **`Repair Suffix` `R01`→`R1`, `R02`→`R2`** — в `CSVExport_Welder Record` и в
  `…Joint Record NOT WELDED`.
* **Заглушки.** `Weld Dump` добавляет 6 пустых колонок (`RT/UT`, `NDT Remarks`, `Tracer Shot`,
  `Weld Point Code`, `Original Joint`, `Repair Suffix`), `CSVExport_Welder Record` — около 40
  (весь блок PWHT/HT, `Weld Length`, `Rej Length`, `System no`, `Testpack No`, `Service Cat`,
  `MIR No/Date`, `DWIR No.`, `wbu`, `Iso Rev No.`, `Spool Rev No.`, `UT%`…),
  `…NOT WELDED` — около 120. **Ни одна из этих колонок не «пустая по данным» —
  она пустая по источнику**, и именно поэтому у каждой NDE-меры есть вторая ветка `… CCC`.
* Производные, добавляемые в `CSVExport_Welder Record`:
  `Dia Inch Factor = if [Weld Type] = "BW" or [Weld Type] = "CLET" then "Y" else "N"`,
  `Cutting Date = Beveling Date = Fitup Date = [Weld Date]`,
  `Total No of films Acc = [RT Film Total] - [Total No of films Rej]`,
  `RT Weld Status = if [RT Report] = "blank" then "HS" else if [RT%] = 100 then "HS CCC" else if [Tracer Shot] = "T" then "T" else ""`.
  Последняя строка — источник статуса `HS CCC`, который есть в списке RT-бэклога «PR all»,
  но отсутствует в списке PWHT-бэклога «EP» (`calculation-logic.md` §0.6).

---

## 2. Состав колонок (425)

Знаком **⁺** ниже помечены колонки, которых **нет** в таблице `Weld Dump` модели — то есть
принесённые Acciona/Inco/`NOT WELDED` или созданные самим union-запросом.

### 2.1 Импортированные колонки (267)

Форма ряда наследуется от `Weld Dump` целиком: **все 234 импортированные колонки `Weld Dump`
присутствуют в «PR all»**, плюс 33 новые. Пять «CCC-шных» колонок —
`Repair Suffix`, `Original Joint`, `Weld Point Code`, `RT/UT`, `NDT Remarks` — формально
принадлежат и `Weld Dump` тоже, но там они **пустые заглушки** (`AddColumn(… each "")`);
данные в них появляются только на строках CCC/Acciona/Inco. `HA` — не импортированная,
а вычисляемая колонка (см. §2.2.1).

Типы импортированных колонок (`tmschema_columns.DataType`): String 203, DateTime 44, Int64 13,
Double 7. У вычисляемых тип в модели не разрешён (`DataType` 1 = Automatic) у 153 из 158;
явно типизированы только пять: `Days Since Last RT` и `PMI% CCC` (Int64), `Manual UT Date.` и
`MonthRT` (DateTime), `Defect Length(MM).` (Double).

Группировка ниже — по тем же блокам, что и в разборе `Weld Dump`
(`analysis/dump/profile.md` §3–§7). У шести колонок в модели имя начинается с пробела
(` SHIPMENT RECV DATE`, ` EREC MIR DATE`, ` EREC MIR NO`, ` SHEET NO`,
` TESTPACK SUB CONTRACTOR`, ` TESTPACK TEST DONE DATE`) — это дефект шапки дампа, ниже
имена показаны без него; в `prall-columns.json` и в приложении A они даны как есть.

**A. Идентичность и скоуп** — 41 колонка

`Joint ID`, `Spool ID`, `RT/UT`, `ISO Number`, `Iso Rev No.`, `Spool No.`, `Weld No.`, `Spool Rev No.`, `Weld Cat`, `Weld Type`, `Dia Inch Factor`, `Dia inch`, `Thickness`, `PDS Area`, `AG/UG/PKG`, `Area Classification`, `wbu`, `System no`, `Testpack No`, `NDT Remarks`, `Service class`, `Service Cat`, `Material Type`, `Sub-Contractor`, `Rework Code`, `Original Joint`, `Repair Suffix`, `WeldPoint No.`, `Weld Point Code`, `WPS No.`, `Welder`, `Golden Weld`, `Subsystem Code`, `Piping Group`, `Priority No`, `PDS Area Type`, `GWBS`, `Joint ID for Heat N` ⁺, `Index` ⁺, `PED`, `Commissioning Package`

**B. Даты производственного цикла** — 8 колонок

`MIR No`, `MIR Date`, `Cutting Date`, `Beveling Date`, `Fitup Date`, `Preheat Date`, `Weld Date`, `DWIR No.`

**C. Блоки методов контроля (PWHT/HT/RT/UT/MT/PMI/PT/FN/PADLT/ORIF)** — 140 колонок

`PWHT Y/N`, `PWHT Weld Status`, `PWHT Selected Date`, `PWHT Exam Req date`, `PWHT Date`, `PWHT Report`, `PWHT Acc/Rej`, `PWHT Client Exam Req Y/N`, `PWHT Remarks`, `PWHT Selected By`, `PWHT Exam Req No`, `PWHT Exam Req By`, `HT%`, `HT Batch No`, `HT Batch Status`, `HT Weld Status`, `HT Selected Date`, `HT Exam Req date`, `HT Date`, `HT Report`, `HT Acc/Rej`, `HT Client Exam Req Y/N`, `HT Remarks`, `HT Selected By`, `HT Exam Req No`, `HT Exam Req By`, `RT%`, `RT Batch No`, `RT Batch Status`, `RT Weld Status`, `RT Selected Date`, `RT Exam Req date`, `RT Date`, `RT Xray No`, `RT Report`, `RT Acc/Rej`, `RT Film Total`, `RT Re-Shoot Rep`, `RT Re-Shoot Data`, `RT Re-Shoot Status`, `RT Re-Shoot Reason`, `RT Re-Shoot Films`, `RT Client Exam Req Y/N`, `RT Remarks`, `RT Selected By`, `RT Exam Req No`, `RT Exam Req By`, `UT%`, `UT Batch No`, `UT Batch Status`, `UT Weld Status`, `UT Selected Date`, `UT Exam Req date`, `UT Date`, `UT Report`, `UT Acc/Rej`, `UT Client Exam Req Y/N`, `UT Remarks`, `UT Selected By`, `UT Exam Req No`, `UT Exam Req By`, `MT%`, `MT Batch No`, `MT Batch Status`, `MT Weld Status`, `MT Selected Date`, `MT Exam Req date`, `MT Date`, `MT Report`, `MT Acc/Rej`, `MT Client Exam Req Y/N`, `MT Remarks`, `MT Selected By`, `MT Exam Req No`, `MT Exam Req By`, `PMI%`, `PMI Batch No`, `PMI Batch Status`, `PMI Weld Status`, `PMI Selected Date`, `PMI Exam Req date`, `PMI Date`, `PMI Report`, `PMI Acc/Rej`, `PMI Client Exam Req Y/N`, `PMI Remarks`, `PMI Selected By`, `PMI Exam Req No`, `PMI Exam Req By`, `PT%`, `PT Batch No`, `PT Batch Status`, `PT Weld Status`, `PT Selected Date`, `PT Exam Req date`, `PT Date`, `PT Report`, `PT Acc/Rej`, `PT Client Exam Req Y/N`, `PT Remarks`, `PT Selected By`, `PT Exam Req No`, `PT Exam Req By`, `FN%`, `FN Batch No`, `FN Batch Status`, `FN Weld Status`, `FN Selected Date`, `FN Exam Req date`, `FN Date`, `FN Report`, `FN Acc/Rej`, `FN Client Exam Req Y/N`, `FN Remarks`, `FN Selected By`, `FN Exam Req No`, `FN Exam Req By`, `PADLT Y/N`, `PADLT Weld Status`, `PADLT Selected Date`, `PADLT Exam Req date`, `PADLT Date`, `PADLT Report`, `PADLT Acc/Rej`, `PADLT Client Exam Req Y/N`, `PADLT Remarks`, `PADLT Selected By`, `PADLT Exam Req No`, `PADLT Exam Req By`, `ORIF Y/N`, `ORIF Weld Status`, `ORIF Selected Date`, `ORIF Exam Req date`, `ORIF Date`, `ORIF Report`, `ORIF Acc/Rej`, `ORIF Client Exam Req Y/N`, `ORIF Selected By`, `ORIF Exam Req No`, `ORIF Exam Req By`

**D. Прослеживаемость материала** — 9 колонок

`Matrl Traceability Y/N`, `GROUP-1`, `IDENT CODE-1`, `TRAC NO-1`, `Part 1`, `GROUP-2`, `IDENT CODE-2`, `TRAC NO-2`, `Part 2`

**E. Ревизии, TPI, ручной UT, длины и плёнки** — 21 колонка

`Revision Status`, `Revision Comments`, `Hold Status`, `Hold Comments`, `Golden Weld Report Date`, `Golden Weld Report No`, `TPI Cross Checked`, `Checked Date`, `Result (A/R)`, `UT Operator ID`, `Manual UT Date`, `Manual UT Report No`, `Manual UT Status`, `Weld Length`, `Rej Length`, `Defect Code`, `Location of Defect`, `Tracer Shot`, `By UT`, `Total No of films Acc`, `Total No of films Rej`

**F. Логистика/шипмент (хвост дампа)** — 13 колонок

`SHIPMENT DATE`, `SHIPMENT RECV DATE`, `EREC MIR DATE`, `EREC MIR NO`, `SHEET NO`, `PACKING LIST NO`, `TESTPACK SUB CONTRACTOR`, `TESTPACK TEST DONE DATE`, `PIP-001-A`, `W24DWIR`, `BHS`, `PIP-124-A`, `WHS`

**G. Добавлено Inco Weld Log** — 16 колонок

`Category 1` ⁺, `Category 2` ⁺, `Drg No` ⁺, `process` ⁺, `Fitup Report No.` ⁺, `First Prod. Joint` ⁺, `VBT Report` ⁺, `VBT Date` ⁺, `OPT Report` ⁺, `OPT Date` ⁺, `RT P1 Rep.` ⁺, `P1 Date` ⁺, `RT P2 Rep.` ⁺, `P2 Date` ⁺, `Repair Length (mm)` ⁺, `Aditional Joint No.RT` ⁺

**H. Добавлено Acciona_Query / Welder Record / сам union** — 19 колонок

`Custom3`, `Custom4` ⁺, `Custom5` ⁺, `Custom6` ⁺, `Custom7` ⁺, `Custom8` ⁺, `Custom9` ⁺, `Custom10` ⁺, `Custom11`, `Custom12`, `Custom13`, `Custom14` ⁺, `CountDelimiter` ⁺, `Count Rows.Count` ⁺, `FT Report` ⁺, `Weld Point First` ⁺, `Last Reshoot Date.1` ⁺, `Last Reshoot Report No.1` ⁺, `Last Reshoot Result.1` ⁺

### 2.2 Вычисляемые колонки (158)

Столбцы **мер / виз / стр / калк** — сколько мер ссылаются на колонку в DAX, в скольких визуалах
её имя встречается где угодно в определении (проекция, фильтр, сортировка), на скольких
страницах, и сколько других вычисляемых колонок её используют. Числа посчитаны машинно
(см. §Проверки); ноль в «мер», «виз» и «калк» = колонка мертва — таких 17.

#### 2.2.1 Ключи и идентификаторы (15)

| колонка | смысл | мер | виз | стр | калк |
|---|---|---:|---:|---:|---:|
| `Welder ID` | `Welder` & "-" & `Sub-Contractor` — глобально уникальный сварщик (табельные номера повторяются между субподрядчиками). | 19 | 140 | 39 | 15 |
| `Joint Uniq "PR all" Column` | DISTINCTCOUNT(Joint ID) в контексте строки — фактически всегда 1. Нигде не используется. | 0 | 0 | 0 | 0 |
| `Service Class + Service Cat+NDT Remarks` | Ключ группировки NDE-страниц: `Service class`+`Service Cat`+`NDT Remarks`+`RT%`. У CCC `Service Cat` пуст → двойной пробел. | 7 | 89 | 33 | 5 |
| `Service Class + Service Cat+NDT Remarks+Welder ID` | То же + `Welder ID` — ключ матрицы «класс × сварщик». | 3 | 0 | 0 | 0 |
| `Service Class + Service Cat+NDT Remarks+Sub-Contractor` | То же + `Sub-Contractor` — ключ матрицы «класс × субподрядчик». | 0 | 1 | 1 | 0 |
| `LINE` | `MID(ISO Number, 9, …)` — номер линии из изометрии. Нигде не используется. | 0 | 0 | 0 | 0 |
| `Train SG` | Для `Service Cat` IN {SG,SGCS} — 3 символа из `Joint ID` (позиции 4-6) = номер train. | 0 | 2 | 2 | 0 |
| `WeldPoint No.1 WP1` | Порядковый номер строки внутри `Joint ID` по возрастанию `Index` (1 = первый weld point). Основа всех «WP1» мер. | 14 | 0 | 0 | 0 |
| `Dia Inch >20<` | Бакет диаметра: 0-20 / 20-199 / >199. | 0 | 11 | 11 | 0 |
| `Weld CAT (NEW)` | `Weld Cat`, но SW+F → "S" (шов SW категории F считается за socket). | 0 | 8 | 8 | 0 |
| `TESTPACK No "PR All"` | Тест-пакет: для CCC — из `AllTrain_CSVExport_Joint Record[Test Package No]` по Joint ID, иначе MAX(`Testpack No`) по Joint ID. | 4 | 9 | 4 | 7 |
| `HA` | Handover Area HA1..HA4: 2-я цифра `Subsystem Code`, иначе 2-я цифра `System no`, иначе LOOKUP по `HA l0_abs_guide[Location Number]` = `PDS Area`. | 4 | 24 | 15 | 0 |
| `Repair & Reweld "PR all"` | Классификация ремонта: суффикс Joint ID R1/R2 → "Repair", RW → "Reweld", `Repair Suffix` RW1 → "Reweld", RS1 → "RS1". Для Inco — пусто. | 28 | 17 | 11 | 2 |
| `Report TYPE` | Какой метод «закрыл» шов: RT/UT/PT/PMI/PWHT/MT по первому непустому отчёту. Нигде не используется. | 0 | 0 | 0 | 0 |
| `By UT All` | "BY UT", если `By UT`=Y, или `RT/UT`=UT, или `HT Remarks`=PAUT, или есть `Manual UT Report No.`. | 0 | 5 | 5 | 0 |

<details><summary>DAX (verbatim, 15 колонок)</summary>

```dax
-- ===== Welder ID =====
'Project WD+WR+INCO+Acciona'[Welder]&"-"&'Project WD+WR+INCO+Acciona'[Sub-Contractor]

-- ===== Joint Uniq "PR all" Column =====
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]))

-- ===== Service Class + Service Cat+NDT Remarks =====
'Project WD+WR+INCO+Acciona'[Service class]&" "&'Project WD+WR+INCO+Acciona'[Service Cat]&" "&'Project WD+WR+INCO+Acciona'[NDT Remarks]&" "&'Project WD+WR+INCO+Acciona'[RT%]

-- ===== Service Class + Service Cat+NDT Remarks+Welder ID =====
'Project WD+WR+INCO+Acciona'[Service class]&" "&'Project WD+WR+INCO+Acciona'[Service Cat]&" "&'Project WD+WR+INCO+Acciona'[NDT Remarks]&" "&'Project WD+WR+INCO+Acciona'[RT%]&" "&'Project WD+WR+INCO+Acciona'[Welder ID]

-- ===== Service Class + Service Cat+NDT Remarks+Sub-Contractor =====
'Project WD+WR+INCO+Acciona'[Service class]&" "&'Project WD+WR+INCO+Acciona'[Service Cat]&" "&'Project WD+WR+INCO+Acciona'[NDT Remarks]&" "&'Project WD+WR+INCO+Acciona'[RT%]&" "&'Project WD+WR+INCO+Acciona'[Sub-Contractor]

-- ===== LINE =====
MID('Project WD+WR+INCO+Acciona'[ISO Number], 9, LEN('Project WD+WR+INCO+Acciona'[ISO Number]))

-- ===== Train SG =====
IF(
    'Project WD+WR+INCO+Acciona'[Service Cat] IN{ "SG","SGCS"},
    MID('Project WD+WR+INCO+Acciona'[Joint ID], 4, 3),
    BLANK() // Вернет пусто, если условие не выполнено
)

-- ===== WeldPoint No.1 WP1 =====
VAR CurrentWP = 'Project WD+WR+INCO+Acciona'[Index]
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
RETURN
    COUNTROWS(
        FILTER(
            'Project WD+WR+INCO+Acciona',
            'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID &&
            'Project WD+WR+INCO+Acciona'[Index] < CurrentWP
        )
    ) + 1

-- ===== Dia Inch >20< =====
IF(
    'Project WD+WR+INCO+Acciona'[Dia inch] <= 20, 
    "0-20",
    IF(
        'Project WD+WR+INCO+Acciona'[Dia inch] > 20 && 'Project WD+WR+INCO+Acciona'[Dia inch] <= 200, 
        "20-199",
        "Greater than 199"
    )
)

-- ===== Weld CAT (NEW) =====
IF(
    'Project WD+WR+INCO+Acciona'[Weld Type] = "SW" && 'Project WD+WR+INCO+Acciona'[Weld Cat] = "F", 
    "S", 
    'Project WD+WR+INCO+Acciona'[Weld Cat]
)

-- ===== TESTPACK No "PR All" =====
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR TPCCCID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record',
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = CurrentJointID
            ),
            'AllTrain_CSVExport_Joint Record'[Test Package No]
        )
    )

VAR MaxTestPackageNoOther = 
    MAXX(
        FILTER(
            'Project WD+WR+INCO+Acciona',
            'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
        ),
        'Project WD+WR+INCO+Acciona'[Testpack No]
    )

RETURN
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        IF(
            ISBLANK(TPCCCID),
            BLANK(),
            TPCCCID
        ),
        IF(
            ISBLANK(MaxTestPackageNoOther),
            BLANK(),
            MaxTestPackageNoOther
        )
    )

-- ===== HA =====
VAR SubsystemVal = 'Project WD+WR+INCO+Acciona'[Subsystem Code]
VAR SystemVal = 'Project WD+WR+INCO+Acciona'[System No]

-- Извлекаем вторые цифры для обоих столбцов
VAR DigitSub = MID(SubsystemVal, 2, 1)
VAR DigitSys = MID(SystemVal, 2, 1)

-- Условие "невалидности" (пусто, NA или NON)
VAR SubIsInvalid = ISBLANK(SubsystemVal) || SubsystemVal = "System-NA - Not Applicable" || CONTAINSSTRING(SubsystemVal, "NON")
VAR SysIsInvalid = ISBLANK(SystemVal) || SystemVal = "System-NA - Not Applicable" || CONTAINSSTRING(SystemVal, "NON")

RETURN
IF (
    -- 1. Сначала проверяем Subsystem Code
    NOT(SubIsInvalid) && DigitSub IN {"1", "2", "3", "4"},
    "HA" & DigitSub,
    
    IF (
        -- 2. Если Subsystem не подошел, проверяем System No
        NOT(SysIsInvalid) && DigitSys IN {"1", "2", "3", "4"},
        "HA" & DigitSys,
        
        -- 3. Если оба столбца пустые/NON/NA, выполняем поиск по справочнику
        LOOKUPVALUE(
            'HA l0_abs_guide'[Handover Area], 
            'HA l0_abs_guide'[Location Number], 'Project WD+WR+INCO+Acciona'[PDS Area]
        )
    )
)

-- ===== Repair & Reweld "PR all" =====
  IF (
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "Inco",
    IF (
        RIGHT ( 'Project WD+WR+INCO+Acciona'[Joint ID], 2 ) = "R1",
        "Repair",
        IF (
            RIGHT ( 'Project WD+WR+INCO+Acciona'[Joint ID], 2 ) = "R2",
            "Repair",
            IF (
                RIGHT ( 'Project WD+WR+INCO+Acciona'[Joint ID], 2 ) = "RW",
                "Reweld",
                IF (
                    'Project WD+WR+INCO+Acciona'[Repair Suffix] = "RW1",
                    "Reweld", 
                    IF (
                        'Project WD+WR+INCO+Acciona'[Repair Suffix] = "RS1",
                        "RS1",
                
                        ""
                    )
                )
            )
        )
    )
)

-- ===== Report TYPE =====
IF('Project WD+WR+INCO+Acciona'[RT Report] <> "" && 'Project WD+WR+INCO+Acciona'[RT/UT] <> "UT", "RT",
IF('Project WD+WR+INCO+Acciona'[UT Report]<>"","UT",
IF('Project WD+WR+INCO+Acciona'[RT/UT]="UT","UT",
IF('Project WD+WR+INCO+Acciona'[PT Report]<>"","PT",
IF('Project WD+WR+INCO+Acciona'[PMI Report]<>"","PMI",
IF('Project WD+WR+INCO+Acciona'[PWHT Report]<>"","PWHT",
IF('Project WD+WR+INCO+Acciona'[PWHT Report No CCC]<>"","PWHT",
IF('Project WD+WR+INCO+Acciona'[MT Report]<>"","MT",
IF('Project WD+WR+INCO+Acciona'[MT Report CCC]<>"","MT")))))))))

-- ===== By UT All =====
IF(
    'Project WD+WR+INCO+Acciona'[By UT] = "Y", 
    "BY UT", 
    IF(
        'Project WD+WR+INCO+Acciona'[RT/UT] = "UT", 
        "BY UT",     
    IF(
        'Project WD+WR+INCO+Acciona'[HT Remarks] = "PAUT", 
        "BY UT",    
    IF(
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <>"", 
        "BY UT",
        BLANK()  -- Это значение по умолчанию, если оба условия ложны
    )
)))

```

</details>

#### 2.2.2 Даты и старение (18)

| колонка | смысл | мер | виз | стр | калк |
|---|---|---:|---:|---:|---:|
| `No of Days "PR all"` | DATEDIFF(Weld Date, TODAY()) — возраст шва в днях. Единственные «часы» отчёта. | 10 | 0 | 0 | 0 |
| `Last_Weld Date "PR all"` | LASTDATE(Weld Date) в текущем контексте. | 0 | 0 | 0 | 1 |
| `Days Since Last Weld` | `Cur_Date "PR all"` − `Last_Weld Date "PR all"`. | 3 | 0 | 0 | 0 |
| `First_Weld Date "PR all"` | FIRSTDATE(Weld Date). | 0 | 0 | 0 | 1 |
| `Days Since First Weld` | `Cur_Date "PR all"` − `First_Weld Date "PR all"`. Нигде не используется. | 0 | 0 | 0 | 0 |
| `Last_RT Date "PR all"` | LASTDATE(RT Date), но только если нет `Manual UT Date.` (UT-строки не считаются RT). | 6 | 13 | 6 | 3 |
| `Days Since Last RT` | `Cur_Date "PR all"` − `Last_RT Date "PR all"`. Именно этим фильтруются окна «2 недели» / «1 месяц». | 16 | 46 | 9 | 4 |
| `Last_UT Date "PR all"` | LASTDATE(`Manual UT Date.`). | 1 | 1 | 1 | 1 |
| `Days Since Last UT` | `Cur_Date "PR all"` − `Last_UT Date "PR all"`. | 5 | 9 | 1 | 1 |
| `No of Days Fit-UP - TODAY "PR all"` | Дней с фит-апа до сегодня — только для швов без `Weld Date` (не сварено). | 0 | 1 | 1 | 1 |
| `No Of Days Fit-UP - Today STATUS "PR all"` | Бакеты 7 / 7-30 / 30-90 / 90-180 / >180 дней. | 0 | 3 | 1 | 0 |
| `No of Days Weld Date - TODAY "PR all"` | Возраст RT-бэклога: нет `RT Date`, тип шва BW/GW/CLET/MW и `RT Weld Status` из белого списка — либо RT%=100 и статус в {?,""}. | 0 | 2 | 1 | 1 |
| `No Of Days Weld Date - Today RT STATUS "PR all"` | Те же 5 бакетов старения для RT-бэклога. | 0 | 3 | 1 | 0 |
| `2 weeks Period for RT` | 37 жёстко зашитых двухнедельных окон по `RT Date`, с 28-Jul-2023. Оси трендовых графиков. | 0 | 4 | 1 | 0 |
| `Week_End_Date from Calendar` | LOOKUP `Calendar[Week_End_Date]` по `Calendar[Date] = RT Date` — конец недели RT. | 0 | 15 | 8 | 0 |
| `MonthRT` | = `RT Date` (тип DateTime, форматируется как месяц). | 0 | 6 | 4 | 0 |
| `YearRT` | FORMAT(RT Date,"YYYY"). | 0 | 14 | 8 | 0 |
| `Days Between RT Selected and RT Date` | DATEDIFF(RT Selected Date, RT Date) — время реакции RT. Нигде не используется. | 0 | 0 | 0 | 0 |

<details><summary>DAX (verbatim, 18 колонок)</summary>

```dax
-- ===== No of Days "PR all" =====
DATEDIFF([Weld Date], TODAY(), DAY)

-- ===== Last_Weld Date "PR all" =====
LASTDATE('Project WD+WR+INCO+Acciona'[Weld Date])

-- ===== Days Since Last Weld =====
IF(ISBLANK([Last_Weld Date "PR all"]),BLANK(),
VALUE([Cur_Date "PR all"]-[Last_Weld Date "PR all"]))

-- ===== First_Weld Date "PR all" =====
FIRSTDATE('Project WD+WR+INCO+Acciona'[Weld Date])

-- ===== Days Since First Weld =====
IF(ISBLANK([First_Weld Date "PR all"]),BLANK(),
VALUE([Cur_Date "PR all"]-[First_Weld Date "PR all"]))

-- ===== Last_RT Date "PR all" =====
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[Manual UT Date.]),
    LASTDATE('Project WD+WR+INCO+Acciona'[RT Date]),
    BLANK()
)

-- ===== Days Since Last RT =====
IF(ISBLANK([Last_RT Date "PR all"]),BLANK(),
VALUE([Cur_Date "PR all"]-[Last_RT Date "PR all"]))

-- ===== Last_UT Date "PR all" =====
    LASTDATE('Project WD+WR+INCO+Acciona'[Manual UT Date.])

-- ===== Days Since Last UT =====
IF(ISBLANK([Last_UT Date "PR all"]),BLANK(),
VALUE([Cur_Date "PR all"]-[Last_UT Date "PR all"]))

-- ===== No of Days Fit-UP - TODAY "PR all" =====
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
    DATEDIFF('Project WD+WR+INCO+Acciona'[Fitup Date], TODAY(), DAY),
    BLANK()
)

-- ===== No Of Days Fit-UP - Today STATUS "PR all" =====
 IF (
    'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] >= 1 && 'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] <= 7,
    "1. 7 Days",
    IF (
        'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] > 7 && 'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] <= 30,
        "2. 7 to 30 Days",
        IF (
            'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] >30 && 'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] <= 90,
            "3. 30 to 90 Days",
            IF (
                'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] > 90 && 'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] <= 180,
                "4. 90 to 180 Days",
                IF (
                'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] > 180,
                "5. Above 180 Days",
                BLANK()
            )
        )
    )
))

-- ===== No of Days Weld Date - TODAY "PR all" =====
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Date]) && 
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"} && 
    CONTAINSROW(
        {"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"}, 
        'Project WD+WR+INCO+Acciona'[RT Weld Status]
    ),
    DATEDIFF('Project WD+WR+INCO+Acciona'[Weld Date], TODAY(), DAY),
    IF(
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"} &&
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0 &&
        'Project WD+WR+INCO+Acciona'[RT%] = 100 &&
        'Project WD+WR+INCO+Acciona'[RT Report] = "" &&
        'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", ""},
        DATEDIFF('Project WD+WR+INCO+Acciona'[Weld Date], TODAY(), DAY),
        BLANK()
    )
)

-- ===== No Of Days Weld Date - Today RT STATUS "PR all" =====
 IF (
    'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] >= 1 && 'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] <= 7,
    "1. 7 Days",
    IF (
        'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] > 7 && 'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] <= 30,
        "2. 7 to 30 Days",
        IF (
            'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] >30 && 'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] <= 90,
            "3. 30 to 90 Days",
            IF (
                'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] > 90 && 'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] <= 180,
                "4. 90 to 180 Days",
                IF (
                'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] > 180,
                "5. Above 180 Days",
                BLANK()
            )
        )
    )
))

-- ===== 2 weeks Period for RT =====
IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 07, 28), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 08, 11)
        ),
        "1. 28-Jul-23 to 11-Aug-23",
IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 08, 11), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 08, 25)
        ),
        "2. 11-Aug-23 to 25-Aug-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 08, 25), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 09, 8)
        ),
        "3. 25-Aug-23 to 8-Sep-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 09, 8), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 09, 22)
        ),
        "4. 8-Sep-23 to 22-Sep-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 09, 22), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 10, 6)
        ),
        "5. 22-Sep-23 to 6-Oct-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 10, 6), 
            'Project WD+WR+INCO+Acciona'[RT Date] <
    /* … обрезано: полный текст в analysis/pbix/raw/prall-columns.json */

-- ===== Week_End_Date from Calendar =====
MAXX(
    FILTER(
        'Calendar', 
        'Calendar'[Date] = 'Project WD+WR+INCO+Acciona'[RT Date]
    ),
    'Calendar'[Week_End_Date]
)

-- ===== MonthRT =====
'Project WD+WR+INCO+Acciona'[RT Date]

-- ===== YearRT =====
FORMAT('Project WD+WR+INCO+Acciona'[RT Date],"YYYY")

-- ===== Days Between RT Selected and RT Date =====
DATEDIFF(
    'Project WD+WR+INCO+Acciona'[RT Selected Date], 
    'Project WD+WR+INCO+Acciona'[RT Date], 
    DAY
)

```

</details>

#### 2.2.3 RT-плёнки, покрытие RT и светофоры (25)

| колонка | смысл | мер | виз | стр | калк |
|---|---|---:|---:|---:|---:|
| `RT Film Ratio % "PR all" For Welder` | Доля забракованных плёнок по сварщику: SUM(films Rej)/SUM(RT Film Total где RT Acc/Rej<>"RS"), ALLEXCEPT(Welder ID). | 0 | 0 | 0 | 1 |
| `RT FILM Ratio % STATUS "PR all"` | Светофор 0-5 % ok / 5-7.5 % monitor / 7.5-10 % critical / 10-100 % Disq.F. | 0 | 74 | 21 | 0 |
| `RT Film Ratio % "PR all" For Welder LAST 2 WEEKS` | То же за окно `Days Since Last RT` ≤ 15, без RS и U/Review. | 0 | 27 | 9 | 1 |
| `RT FILM Ratio % STATUS LAST 2 WEEKS` | Тот же светофор для окна 2 недели. Самая используемая калк-колонка в визуалах (70). | 0 | 105 | 20 | 0 |
| `RT Film Ratio % "PR all" For Welder LAST 1 MONTH` | То же за окно ≤ 30 дней. | 0 | 9 | 4 | 1 |
| `RT FILM Ratio % STATUS LAST 1 Month` | Светофор для окна 1 месяц. | 0 | 16 | 4 | 0 |
| `RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"` | Доля брака плёнок по (класс сервиса × субподрядчик). | 0 | 18 | 9 | 1 |
| `RT FILM Ratio % STATUS for Service Class By SUBCON "PR all"` | Светофор 0-2 / 2-4 / 4-5 / >5 % для класса сервиса. | 0 | 24 | 11 | 0 |
| `RT Ratio % For Welder (<5% ; >5%) "PR all"` | Покрытие RT по сварщику: distinct Joint ID с RT-отчётом / все сваренные (BW,GW,CLET,MW). | 0 | 2 | 2 | 1 |
| `RT Ratio % STATUS for Welder Cover 5% "PR all"` | ">5 % ok" / "<5 % Action" / "No RT". | 0 | 80 | 25 | 0 |
| `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"` | Покрытие RT/UT по классу сервиса (COALESCE к 0). | 0 | 30 | 8 | 1 |
| `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all" STATUS` | "<5 % CHECK" / "5-10 %". | 0 | 17 | 8 | 0 |
| `RT Ratio % For WPS "PR all"` | Доля брака плёнок в разрезе `WPS No.`. | 0 | 0 | 0 | 1 |
| `RT Ratio % STATUS for WPS` | SWITCH-светофор 0 / <1 / 1-2 / 2-5 / 5-10 / >10 %. | 0 | 2 | 2 | 0 |
| `RT Ratio % For Material Type "PR all"` | Доля брака плёнок в разрезе `Material Type`. | 0 | 0 | 0 | 1 |
| `RT Ratio % STATUS for Material Type` | Тот же SWITCH-светофор по материалу. | 0 | 2 | 2 | 0 |
| `% of Total Reject` | SUM(films Rej)/SUM(RT Film Total) без ALLEXCEPT. Нигде не используется. | 0 | 0 | 0 | 0 |
| `QTY Welder ID & No RT by Service Class + Service Cat+NDT Remarks` | Сколько сварщиков в классе сервиса вообще не имеют RT-отчёта. Нигде не используется. | 0 | 0 | 0 | 0 |
| `Has_RT_Report` | COUNTROWS с RT Report<>"" по (Welder ID × класс сервиса). Нигде не используется. | 0 | 0 | 0 | 0 |
| `BATCH QTY Joints` | Число уникальных стыков в RT-партии (`RT Batch No`), без ремонтов и только сваренные. | 0 | 1 | 1 | 0 |
| `Duplicate RT Report` | DISTINCTCOUNT(RT Report) по Joint ID — детектор дублей отчётов. | 0 | 2 | 1 | 0 |
| `Duplicate RT Report by Joint` | DISTINCTCOUNT(Joint ID) по `RT Report` — один отчёт на несколько стыков. | 0 | 2 | 1 | 0 |
| `Duplicate RT Date` | DISTINCTCOUNT(RT Date) по Joint ID. | 0 | 3 | 3 | 0 |
| `Duplicate Weld Date` | DISTINCTCOUNT(Weld Date) по Joint ID — сварка одного стыка в разные дни. | 0 | 7 | 7 | 0 |
| `Total Welded Dia "PR all" Table` | SUM(Dia inch) по сваренным строкам (Weld Date>0). | 8 | 0 | 0 | 0 |

<details><summary>DAX (verbatim, 25 колонок)</summary>

```dax
-- ===== RT Film Ratio % "PR all" For Welder =====
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    )
) * 1

-- ===== RT FILM Ratio % STATUS "PR all" =====
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] >= 0 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] < 0.05,
        "1. 0 to 5% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] >= 0.05 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] < 0.075,
            "2. 5 to 7.5% - monitor",
            IF (
                'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] >= 0.075 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] < 0.10,
                "3. 7.5 to 10% - Critical",
                IF (
                    'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] >= 0.10 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] <= 1,
                    "4. 10 to 100% - Disq.F",
                    BLANK()
                )
            )
        )
    )
)

-- ===== RT Film Ratio % "PR all" For Welder LAST 2 WEEKS =====
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}
        )
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}
        )
    )
)

-- ===== RT FILM Ratio % STATUS LAST 2 WEEKS =====
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.05,
        "1. 0 to 5% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.05 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.075,
            "2. 5 to 7.5% - monitor",
            IF (
                'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.075 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.10,
                "3. 7.5 to 10% - Critical",
                IF (
                    'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.10 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] <= 1,
                    "4. 10 to 100% - Disq.F",
                    BLANK()
                )
            )
        )
    )
)

-- ===== RT Film Ratio % "PR all" For Welder LAST 1 MONTH =====
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}
        )
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}
        )
    )
)

-- ===== RT FILM Ratio % STATUS LAST 1 Month =====
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] >= 0 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] < 0.05,
        "1. 0 to 5% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] >= 0.05 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] < 0.075,
            "2. 5 to 7.5%-monitor",
            IF (
                'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] >= 0.075 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] < 0.10,
                "3. 7.5 to 10%-Critical",
                IF (
                    'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] >= 0.10 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] <= 1,
                    "4. 10 to 100% - Disq.F",
                    BLANK()
                )
            )
        )
    )
)

-- ===== RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all" =====
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks],'Project WD+WR+INCO+Acciona'[Sub-Contractor])
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks],'Project WD+WR+INCO+Acciona'[Sub-Contractor])
    )
) * 1

-- ===== RT FILM Ratio % STATUS for Service Class By SUBCON "PR all" =====
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] >= 0 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] < 0.02,
        "1. 0 to 2% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] >= 0.02 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] < 0.04,
            "2. 2 to 4% - monitor",
            IF (
                'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] >= 0.04 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] < 0.05,
                "3. 4 to 5% - Critical",
                IF (
                    'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] >= 0.05 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] <= 1,
                    "4. 5 to 100% - Action",
                    BLANK()
                )
            )
        )
    )
)

-- ===== RT Ratio % For Welder (<5% ; >5%) "PR all" =====
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    )
) * 1

-- ===== RT Ratio % STATUS for Welder Cover 5% "PR all" =====
IF (
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Welder (<5% ; >5%) "PR all"] >= 0.05, 
    "1. > 5% - ok",
    IF (
        'Project WD+WR+INCO+Acciona'[RT Ratio % For Welder (<5% ; >5%) "PR all"] < 0.05 && 
        'Project WD+WR+INCO+Acciona'[RT Ratio % For Welder (<5% ; >5%) "PR all"] > 0, 
        "2. < 5% - Action",
        IF (
            ISBLANK('Project WD+WR+INCO+Acciona'[RT Ratio % For Welder (<5% ; >5%) "PR all"]) && 
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"} && 
            'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
            "3. No RT",
            BLANK()
        )
    )
)

-- ===== RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all" =====
COALESCE(
    DIVIDE(
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[RT Report] <> "",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks])
        ),
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks])
        )
    ),
    0
)

-- ===== RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all" STATUS =====
IF (
    'Project WD+WR+INCO+Acciona'[RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"] < 0.05, 
    "1. < 5% - CHECK", 
    IF (
        'Project WD+WR+INCO+Acciona'[RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"] >= 0.05 && 
        'Project WD+WR+INCO+Acciona'[RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"] < 0.1, 
        "2. 5% > 10%",
        BLANK() 
    )
)

-- ===== RT Ratio % For WPS "PR all" =====
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[WPS No.])
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[WPS No.])
    )
) * 1

-- ===== RT Ratio % STATUS for WPS =====
SWITCH(TRUE(),
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] = 0, "0%",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] > 0 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] <= 0.01, "1. <1% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] > 0.01 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] <= 0.02, "2. 1% - 2% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] > 0.02 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] <= 0.05, "3. 2% - 5% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] > 0.05 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] <= 0.10, "4. 5% - 10% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] > 0.10, "5. > 10% ",
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"]) &&
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"} &&
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0, "6. No RT",
    BLANK()
)

-- ===== RT Ratio % For Material Type "PR all" =====
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Material Type])
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Material Type])
    )
) * 1

-- ===== RT Ratio % STATUS for Material Type =====
SWITCH(TRUE(),
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] = 0, "0%",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] > 0 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] <= 0.01, "1. <1% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] > 0.01 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] <= 0.02, "2. 1% - 2% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] > 0.02 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] <= 0.05, "3. 2% - 5% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] > 0.05 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] <= 0.10, "4. 5% - 10% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] > 0.10, "5. > 10% ",
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"]) &&
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"} &&
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0, "6. No RT",
    BLANK()
)

-- ===== % of Total Reject =====
DIVIDE(
    SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]))

-- ===== QTY Welder ID & No RT by Service Class + Service Cat+NDT Remarks =====
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Weld Date]>0,
            'Project WD+WR+INCO+Acciona'[RT Report] = "",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks],'Project WD+WR+INCO+Acciona'[Sub-Contractor]))

-- ===== Has_RT_Report =====
CALCULATE(
    COUNTROWS('Project WD+WR+INCO+Acciona'),
    'Project WD+WR+INCO+Acciona'[RT Report] <> "",
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID], 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks])
)

-- ===== BATCH QTY Joints =====
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
        'Project WD+WR+INCO+Acciona'[Weld Date]>0,
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[RT Batch No])
    )

-- ===== Duplicate RT Report =====
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[RT Report]),
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Joint ID])
)

-- ===== Duplicate RT Report by Joint =====
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[RT Report]))

-- ===== Duplicate RT Date =====
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[RT Date]),
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Joint ID])
)

-- ===== Duplicate Weld Date =====
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Weld Date]),
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Joint ID])
)

-- ===== Total Welded Dia "PR all" Table =====
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0)

```

</details>

#### 2.2.4 CCC-ветки NDE и сверки с Joint Record / Talisman (45)

| колонка | смысл | мер | виз | стр | калк |
|---|---|---:|---:|---:|---:|
| `PWHT Y/N CCC` | PWHT-признак для CCC из `AllTrain_CSVExport_Joint Record[PWHT]` по `Joint ID "JR"`; иначе BLANK. Для не-CCC — BLANK. | 17 | 12 | 10 | 2 |
| `PWHT Report No CCC` | Номер отчёта PWHT для CCC из Joint Record. | 16 | 6 | 4 | 3 |
| `PWHT Date No CCC` | Дата PWHT для CCC из Joint Record. | 0 | 0 | 0 | 1 |
| `PWHT Report "PR All"` | COALESCE: `PWHT Report` (дамп) иначе `PWHT Report No CCC`. | 5 | 8 | 7 | 3 |
| `PWHT Date "PR All"` | COALESCE: `PWHT Date` иначе `PWHT Date No CCC`. | 0 | 2 | 2 | 0 |
| `PWHT Status PR ALL` | Итоговый Y/N/25.01 из `PWHT Y/N` (дамп) с падением на `PWHT Y/N CCC`. Здесь живёт токен 25.01 (ruling R-04). | 0 | 4 | 4 | 0 |
| `PWHT Y/N CCC (NEW)` | Переписанное «с нуля» правило PWHT для CCC: белый список из 13 Joint ID → "N", далее по `Weld Type`, `WPS No.`, `Thickness`, `Material Type`, `Service class`. | 1 | 7 | 5 | 1 |
| `PWHT Y/N CCC True/False Status` | Сверка нового правила со старым `PWHT Y/N CCC`: TRUE/FALSE/"". | 0 | 2 | 2 | 0 |
| `MT Report CCC` | MAX(`MT Root Report No`) из Joint Record по Joint ID. | 1 | 0 | 0 | 2 |
| `MT Date CCC` | MAX(`MT Root Date`) из Joint Record. | 0 | 0 | 0 | 1 |
| `MT% CCC` | MAX(`MT Root(%)`) из Joint Record. | 0 | 2 | 2 | 1 |
| `MT Report "PR All"` | COALESCE(`MT Report`, `MT Report CCC`). | 6 | 9 | 6 | 3 |
| `MT Date "PR All"` | COALESCE(`MT Date`, `MT Date CCC`). | 2 | 1 | 1 | 0 |
| `MT % "PR All"` | `MT%` для не-CCC, `MT% CCC` для CCC. | 0 | 1 | 1 | 0 |
| `PMI Report CCC` | MAX(`PMI Report No`) из Joint Record. | 0 | 0 | 0 | 1 |
| `PMI Date CCC` | MAX(`PMI Date`) из Joint Record. | 0 | 0 | 0 | 1 |
| `PMI% CCC` | MAX(`PMI(%)`) из Joint Record. | 0 | 0 | 0 | 1 |
| `PMI Report "PR All"` | COALESCE(`PMI Report`, `PMI Report CCC`). | 4 | 5 | 4 | 3 |
| `PMI Date "PR All"` | COALESCE(`PMI Date`, `PMI Date CCC`). | 0 | 1 | 1 | 0 |
| `PMI % "PR All"` | `PMI%` / `PMI% CCC` по субподрядчику. Нигде не используется. | 0 | 0 | 0 | 0 |
| `PT Report CCC` | MAX(`PT Root Report No`) из Joint Record. | 0 | 0 | 0 | 1 |
| `PT Date CCC` | MAX(`PT Root Date`) из Joint Record. | 0 | 0 | 0 | 1 |
| `PT% CCC` | MAX(`PT Root(%)`) из Joint Record. | 0 | 0 | 0 | 1 |
| `PT Report "PR All"` | COALESCE(`PT Report`, `PT Report CCC`). | 6 | 8 | 5 | 3 |
| `PT Date "PR All"` | COALESCE(`PT Date`, `PT Date CCC`). | 2 | 1 | 1 | 0 |
| `PT % "PR All"` | `PT%` / `PT% CCC` по субподрядчику. | 0 | 1 | 1 | 0 |
| `HT Report CCC` | MAX(`HT Report No`) из Joint Record. | 0 | 0 | 0 | 1 |
| `HT Date CCC` | MAX(`HT Date`) из Joint Record. | 0 | 0 | 0 | 1 |
| `HT% CCC` | MAX(`HT(%)`) из Joint Record. | 0 | 0 | 0 | 1 |
| `HT Report "PR All"` | COALESCE(`HT Report`, `HT Report CCC`). | 4 | 5 | 4 | 3 |
| `HT Date "PR All"` | COALESCE(`HT Date`, `HT Date CCC`). | 0 | 1 | 1 | 0 |
| `HT % "PR All"` | `HT%` / `HT% CCC` по субподрядчику. Нигде не используется. | 0 | 0 | 0 | 0 |
| `DWIR CCC From "JR"` | `Weld Report No` из Joint Record для CCC. | 0 | 0 | 0 | 1 |
| `DWIR Report "PR All"` | COALESCE(`DWIR No.`, `DWIR CCC From "JR"`). Кардинальность 557 690. | 2 | 2 | 2 | 3 |
| `Thickness From "JR"` | Толщина CCC из Joint Record (`Wall Thickness`) — для сверки. | 0 | 1 | 1 | 1 |
| `Thickness from "JR" True/False Status` | Совпадает ли `Thickness From "JR"` с `Thickness`. | 0 | 2 | 1 | 0 |
| `WPS From "Talisman"` | `WPS CODE` из `TALISMAN DATA` для CCC — для сверки. | 0 | 4 | 2 | 1 |
| `WPS from "Talisman" True/False Status` | Совпадает ли WPS из Talisman с `WPS No.`. | 0 | 2 | 2 | 0 |
| `Rework Code "PR All"` | `Rework Code` из Joint Record, иначе собственный `Rework Code`. | 0 | 2 | 2 | 0 |
| `CROSS CHECK DATA & Talisman JOINT ID` | Для CCC: найден ли `Joint ID` в `TALISMAN DATA` («NO», если нет). 1 469 921 различных значений. | 0 | 3 | 2 | 0 |
| `Spool ID Status` | Для CCC — `Talisman Spool Dump[Status Released]`, иначе `Weld Dump[Status FABRICATED]` по `Spool ID`. | 4 | 1 | 1 | 0 |
| `Spool ID CCC PWHT Status` | Для CCC — `Talisman Spool Dump[Status PWHT Spool Date]`. | 1 | 1 | 1 | 0 |
| `Status Fabricated from "WD"` | `Weld Dump[Status FABRICATED]` по Joint ID. Нигде не используется. | 0 | 0 | 0 | 0 |
| `Status Spool NDE from "WD"` | `Weld Dump[Status Spool NDE]` по Joint ID. Нигде не используется. | 0 | 0 | 0 | 0 |
| `Last Spool Status from "WD"` | `Weld Dump[Last Status]` по Joint ID. Нигде не используется. | 0 | 0 | 0 | 0 |

<details><summary>DAX (verbatim, 45 колонок)</summary>

```dax
-- ===== PWHT Y/N CCC =====
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR PWHT_Value = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = 'Project WD+WR+INCO+Acciona'[Joint ID] &&
                'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC"
            ),
            'AllTrain_CSVExport_Joint Record'[PWHT]
        )
    RETURN
        IF(
            ISBLANK(PWHT_Value),
            "N",
            PWHT_Value
        )
)

-- ===== PWHT Report No CCC =====
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR PWHT_Report = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = 'Project WD+WR+INCO+Acciona'[Joint ID]
            ),
            'AllTrain_CSVExport_Joint Record'[PWHT Report No]
        )
    RETURN
        PWHT_Report
)

-- ===== PWHT Date No CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
        ),
        'AllTrain_CSVExport_Joint Record'[PWHT Date]
    )
)

-- ===== PWHT Report "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[PWHT Report] <> "", 
    'Project WD+WR+INCO+Acciona'[PWHT Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[PWHT Report No CCC] <>"", 
        'Project WD+WR+INCO+Acciona'[PWHT Report No CCC], 
        BLANK()
    )
)

-- ===== PWHT Date "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[PWHT Date]>0, 
    'Project WD+WR+INCO+Acciona'[PWHT Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[PWHT Date No CCC]>0, 
        'Project WD+WR+INCO+Acciona'[PWHT Date No CCC], 
        BLANK()
    )
)

-- ===== PWHT Status PR ALL =====
    IF('Project WD+WR+INCO+Acciona'[PWHT Y/N]="Y","Y",
IF('Project WD+WR+INCO+Acciona'[PWHT Y/N]="N","N",
IF('Project WD+WR+INCO+Acciona'[PWHT Y/N]="25.01","25.01",
IF('Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y","Y",
IF('Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="N","N")))))

-- ===== PWHT Y/N CCC (NEW) =====
IF (
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
    IF (
        'Project WD+WR+INCO+Acciona'[Joint ID] IN { 
            "11090A1-SV6209181-SP4-12RS1", 
            "11040A1-HHS6292141-SP30-258RS1", 
            "11020P5-NG6202001-SP5-12",
            "11020P5-NG6202001-SP6-16",
            "11040A1-HHS6292143-SP1A-3RS1",
            "11090A1-SV6209066-SP3-10",
            "11090A1-N6209106A-SP2-7",
            "11010P4-SF6284102-SP6-11",
            "11020P5-SV6202157-SP1-5",
            "11020A1-SV6202193A-SP1-4",
            "11020A1-AG6202007-SP10-701", 
            "11020A1-SV6202064B-SP4-701",
            "11060A3-NR6206006-SP2-3"
        },
        "N", -- АБСОЛЮТНЫЙ ПРИОРИТЕТ
        IF (
            'Project WD+WR+INCO+Acciona'[Weld Type] IN { "THD" },
            "N",
            IF (
                'Project WD+WR+INCO+Acciona'[WPS No.] IN { "CS/LTCS-015", "CS/LTCS-017" } && 
                'Project WD+WR+INCO+Acciona'[Weld Type] IN { "SP" },
                "N",
                IF (
                    'Project WD+WR+INCO+Acciona'[Weld Type] IN { "SP" } &&
                    'Project WD+WR+INCO+Acciona'[Service class] IN { "3R1B3", "6P1A", "6P1AB", "6R1B", "9P1A", "9S1A" },
                    "N",
                    IF (
                        'Project WD+WR+INCO+Acciona'[Weld Type] IN { "LET" } && 
                        'Project WD+WR+INCO+Acciona'[PWHT Report No CCC] <> "",
                        "Y",
                        IF (
                            'Project WD+WR+INCO+Acciona'[Weld Type] IN { "RPD" } &&
    /* … обрезано: полный текст в analysis/pbix/raw/prall-columns.json */

-- ===== PWHT Y/N CCC True/False Status =====
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[PWHT Y/N CCC (NEW)]),
    "",  -- Если ' пустое, возвращаем строку ""
    IF(
        'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC (NEW)] = 'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC],
        "TRUE",  -- Если равны, возвращаем строку "TRUE"
        "FALSE"  -- Если не равны, возвращаем строку "FALSE"
    )
)

-- ===== MT Report CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[MT Root Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[MT Root Report No]
    )
)

-- ===== MT Date CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[MT Root Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[MT Root Date]
    )
)

-- ===== MT% CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[Service Class] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[MT Root(%)]
    )
)

-- ===== MT Report "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[MT Report] <> "", 
    'Project WD+WR+INCO+Acciona'[MT Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[MT Report CCC] <>"", 
        'Project WD+WR+INCO+Acciona'[MT Report CCC], 
        BLANK()
    )
)

-- ===== MT Date "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[MT Date]>0, 
    'Project WD+WR+INCO+Acciona'[MT Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[MT Date CCC]>0, 
        'Project WD+WR+INCO+Acciona'[MT Date CCC], 
        BLANK()
    )
)

-- ===== MT % "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    IF(
        'Project WD+WR+INCO+Acciona'[MT%] >= 0, 
        'Project WD+WR+INCO+Acciona'[MT%], 
        BLANK()
    ),
    IF(
        'Project WD+WR+INCO+Acciona'[MT% CCC] >= 0, 
        'Project WD+WR+INCO+Acciona'[MT% CCC], 
        BLANK()
    )
)

-- ===== PMI Report CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[PMI Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[PMI Report No]
    )
)

-- ===== PMI Date CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[PMI Date]>0
        ),
        'AllTrain_CSVExport_Joint Record'[PMI Date]
    )
)

-- ===== PMI% CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[Service Class] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[PMI(%)]
    )
)

-- ===== PMI Report "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[PMI Report] <> "", 
    'Project WD+WR+INCO+Acciona'[PMI Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[PMI Report CCC] <>"", 
        'Project WD+WR+INCO+Acciona'[PMI Report CCC], 
        BLANK()
    )
)

-- ===== PMI Date "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[PMI Date]>0, 
    'Project WD+WR+INCO+Acciona'[PMI Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[PMI Date CCC]>0, 
        'Project WD+WR+INCO+Acciona'[PMI Date CCC], 
        BLANK()
    )
)

-- ===== PMI % "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    IF(
        'Project WD+WR+INCO+Acciona'[PMI%] >= 0, 
        'Project WD+WR+INCO+Acciona'[PMI%], 
        BLANK()
    ),
    IF(
        'Project WD+WR+INCO+Acciona'[PMI% CCC] >= 0, 
        'Project WD+WR+INCO+Acciona'[PMI% CCC], 
        BLANK()
    )
)

-- ===== PT Report CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[PT Root Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[PT Root Report No]
    )
)

-- ===== PT Date CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[PT Root Date]>0
        ),
        'AllTrain_CSVExport_Joint Record'[PT Root Date]
    )
)

-- ===== PT% CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[Service Class] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[PT Root(%)]
    )
)

-- ===== PT Report "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[PT Report] <> "", 
    'Project WD+WR+INCO+Acciona'[PT Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[PT Report CCC] <>"", 
        'Project WD+WR+INCO+Acciona'[PT Report CCC], 
        BLANK()
    )
)

-- ===== PT Date "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[PT Date]>0, 
    'Project WD+WR+INCO+Acciona'[PT Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[PT Date CCC]>0, 
        'Project WD+WR+INCO+Acciona'[PT Date CCC], 
        BLANK()
    )
)

-- ===== PT % "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    IF(
        'Project WD+WR+INCO+Acciona'[PT%]>=0, 
        'Project WD+WR+INCO+Acciona'[PT%], 
        BLANK()
    ),
    IF(
        'Project WD+WR+INCO+Acciona'[PT% CCC]>=0, 
        'Project WD+WR+INCO+Acciona'[PT% CCC], 
        BLANK()
    )
)

-- ===== HT Report CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[HT Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[HT Report No]
    )
)

-- ===== HT Date CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[HT Date]>0
        ),
        'AllTrain_CSVExport_Joint Record'[HT Date]
    )
)

-- ===== HT% CCC =====
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[Service Class] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[HT(%)]
    )
)

-- ===== HT Report "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[HT Report] <> "", 
    'Project WD+WR+INCO+Acciona'[HT Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[HT Report CCC] <>"", 
        'Project WD+WR+INCO+Acciona'[HT Report CCC], 
        BLANK()
    )
)

-- ===== HT Date "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[HT Date]>0, 
    'Project WD+WR+INCO+Acciona'[HT Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[HT Date CCC]>0, 
        'Project WD+WR+INCO+Acciona'[HT Date CCC], 
        BLANK()
    )
)

-- ===== HT % "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    IF(
        'Project WD+WR+INCO+Acciona'[HT%]>=0, 
        'Project WD+WR+INCO+Acciona'[HT%], 
        BLANK()
    ),
    IF(
        'Project WD+WR+INCO+Acciona'[HT% CCC]>=0, 
        'Project WD+WR+INCO+Acciona'[HT% CCC], 
        BLANK()
    )
)

-- ===== DWIR CCC From "JR" =====
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR DWIRFromJR = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
            ),
            'AllTrain_CSVExport_Joint Record'[Weld Report No]
        )
    RETURN DWIRFromJR
)

-- ===== DWIR Report "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[DWIR No.] <> "", 
    'Project WD+WR+INCO+Acciona'[DWIR No.], 
    IF(
        'Project WD+WR+INCO+Acciona'[DWIR CCC From "JR"] <>"", 
        'Project WD+WR+INCO+Acciona'[DWIR CCC From "JR"], 
        BLANK()
    )
)

-- ===== Thickness From "JR" =====
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR ThiknessFromJR = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
            ),
            'AllTrain_CSVExport_Joint Record'[Wall Thickness]
        )
    RETURN ThiknessFromJR
)

-- ===== Thickness from "JR" True/False Status =====
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[Thickness From "JR"]),
    "",  -- Если ' пустое, возвращаем строку ""
    IF(
        'Project WD+WR+INCO+Acciona'[Thickness From "JR"] = 'Project WD+WR+INCO+Acciona'[Thickness],
        "TRUE",  -- Если равны, возвращаем строку "TRUE"
        "FALSE"  -- Если не равны, возвращаем строку "FALSE"
    )
)

-- ===== WPS From "Talisman" =====
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR WPSFromTalisman = 
        MAXX(
            FILTER(
                'TALISMAN DATA', 
                'TALISMAN DATA'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
            ),
            'TALISMAN DATA'[WPS CODE]
        )
    RETURN WPSFromTalisman
)

-- ===== WPS from "Talisman" True/False Status =====
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[WPS From "Talisman"]),
    "",  -- Если ' пустое, возвращаем строку ""
    IF(
        'Project WD+WR+INCO+Acciona'[WPS From "Talisman"] = 'Project WD+WR+INCO+Acciona'[WPS No.],
        "TRUE",  -- Если равны, возвращаем строку "TRUE"
        "FALSE"  -- Если не равны, возвращаем строку "FALSE"
    )
)

-- ===== Rework Code "PR All" =====
VAR ReworkFromAllTrain = 
    CALCULATE(
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record',
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
            ),
            'AllTrain_CSVExport_Joint Record'[Rework Code]
        )
    )

RETURN 
    IF(
        ISBLANK(ReworkFromAllTrain),
        'Project WD+WR+INCO+Acciona'[Rework Code],
        ReworkFromAllTrain
    )

-- ===== CROSS CHECK DATA & Talisman JOINT ID =====
VAR TalismanJointID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-contractor] = "CCC",
        LOOKUPVALUE(
            'TALISMAN DATA'[Joint ID],
            'TALISMAN DATA'[Joint ID],
            'Project WD+WR+INCO+Acciona'[Joint ID]
        ),
        BLANK()
    )
RETURN
IF(
    'Project WD+WR+INCO+Acciona'[Sub-contractor] = "CCC",
    IF(
        ISBLANK(TalismanJointID),
        "NO",
        TalismanJointID
    ),
    BLANK()
)

-- ===== Spool ID Status =====
VAR CurrentSpoolID = 'Project WD+WR+INCO+Acciona'[Spool ID]
VAR SubContractor = 'Project WD+WR+INCO+Acciona'[Sub-Contractor]

RETURN
    IF(
        SubContractor = "CCC",
        MAXX(
            FILTER(
                'Talisman Spool Dump',
                'Talisman Spool Dump'[Spool ID] = CurrentSpoolID
            ),
            'Talisman Spool Dump'[Status Released]
        ),
        MAXX(
            FILTER(
                'Weld Dump',
                'Weld Dump'[Spool ID] = CurrentSpoolID &&
                (
                    SubContractor <> "CCC" || 'Weld Dump'[Sub-Contractor] <> "CCC"
                )
            ),
            'Weld Dump'[Status FABRICATED]
        )
    )

-- ===== Spool ID CCC PWHT Status =====
VAR CurrentSpoolID = 'Project WD+WR+INCO+Acciona'[Spool ID]
VAR SubContractor = 'Project WD+WR+INCO+Acciona'[Sub-Contractor]
RETURN
    IF(
        SubContractor = "CCC",
        MAXX(
            FILTER(
                'Talisman Spool Dump',
                'Talisman Spool Dump'[Spool ID] = CurrentSpoolID
            ),
            'Talisman Spool Dump'[Status PWHT Spool Date]
        ))

-- ===== Status Fabricated from "WD" =====
MAXX(
    FILTER(
        ALL('Weld Dump'),
        'Weld Dump'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
    ),
    'Weld Dump'[Status FABRICATED]
)

-- ===== Status Spool NDE from "WD" =====
MAXX(
    FILTER(
        ALL('Weld Dump'),
        'Weld Dump'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
    ),
    'Weld Dump'[Status Spool NDE]
)

-- ===== Last Spool Status from "WD" =====
MAXX(
    FILTER(
        ALL('Weld Dump'),
        'Weld Dump'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
    ),
    'Weld Dump'[Last Status]
)

```

</details>

#### 2.2.5 UT-блок: трекеры, длины, проценты брака (28)

| колонка | смысл | мер | виз | стр | калк |
|---|---|---:|---:|---:|---:|
| `UT Report "PR All"` | COALESCE: `UT Report` → для CCC `UT TRACKER (CCC)_Talisman[UT1 REP NO]` → если `RT/UT`="UT", то `RT Report`. | 1 | 9 | 8 | 1 |
| `UT Date "PR All"` | Аналогично для даты UT. | 0 | 1 | 1 | 1 |
| `UT Operator ID.` | Оператор UT: из строки для GAC/TEKFEN/Inco, из трекера CCC — для CCC. | 0 | 4 | 3 | 0 |
| `Manual UT Date.` | Единая дата UT: `UT Date "PR All"` иначе `Manual UT Date`, по субподрядчику. | 0 | 1 | 1 | 3 |
| `Manual UT Report No.` | Единый номер отчёта UT — ключевой признак «UT сделан». | 17 | 7 | 6 | 12 |
| `Manual UT Status.` | Единый результат UT (A/R): `UT Acc/Rej` иначе `Manual UT Status`, по (Joint ID, Welder ID). | 8 | 1 | 1 | 3 |
| `Inspected Length(MM).` | Длина шва, проконтролированная UT = `Weld Length "PR all"` там, где есть `Manual UT Report No.`. | 3 | 0 | 0 | 3 |
| `Defect Length(MM).` | Длина дефекта: Inco → `Repair Length (mm)`/1000; By UT="Y" → `Rej Length`; CCC при R → трекер CCC; иначе 0. | 3 | 2 | 2 | 3 |
| `Weld Length "PR all"` | Длина шва в метрах: Inco — `Weld Length`/1000, иначе LOOKUP по справочнику `Weld Length[Dia inch]`. | 3 | 0 | 0 | 1 |
| `Cross Verification-by CTJV (TPI).` | Кросс-проверка TPI из трекеров GAC/TEK. Нигде не используется. | 0 | 0 | 0 | 0 |
| `CTJV VERIFICATION Date.` | Дата проверки CTJV из трекеров GAC/TEK. Нигде не используется. | 0 | 0 | 0 | 0 |
| `CTJV VERIFICATION BY.` | Кто проверил (CTJV). Нигде не используется. | 0 | 0 | 0 | 0 |
| `UT Rej Length Rate % "PR all" For Welder` | Доля брака UT по длине на сварщика: SUM(Defect Length)/SUM(Inspected Length). | 0 | 13 | 10 | 1 |
| `UT Rej Rate % STATUS for Welder by Length` | Светофор 0-1.5 % ok / 1.5-2 % monitor / >2 % action. | 0 | 7 | 5 | 0 |
| `UT Rej Rate % "PR all" For Welder by Joint` | Доля брака UT по стыкам на сварщика. | 0 | 12 | 9 | 1 |
| `UT Rej Rate % STATUS for Welder by Joint` | Светофор 0-10 % / 10-100 %. | 0 | 6 | 4 | 0 |
| `UT Rej Rate % by joint "PR all" For Sub-Con` | То же по субподрядчику. | 0 | 0 | 0 | 1 |
| `UT Rej Rate % STATUS for Sub-Con by Joint` | Светофор 0-3 / 3-5 / >5 %. | 0 | 6 | 4 | 0 |
| `UT Rej Rate % by Length "PR all" For Sub-Con` | Доля брака UT по длине на субподрядчика. | 0 | 0 | 0 | 1 |
| `UT Rej Rate % STATUS for Sub-Con by Length` | Светофор 0-1 / 1-1.5 / >1.5 %. | 0 | 6 | 4 | 0 |
| `UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS` | То же по длине за окно `Days Since Last UT` ≤ 15. | 0 | 17 | 8 | 1 |
| `UT Rej Rate % STATUS for Welder by Length Last 2 Weeks` | Светофор для окна 2 недели. | 0 | 19 | 6 | 0 |
| `UT Ratio % For Welder (<5% ; >5%) "PR all"` | Покрытие UT по сварщику. Нигде не используется. | 0 | 0 | 0 | 0 |
| `UT Status TR/FL` | Совпадает ли `UT Acc/Rej` с `Manual UT Status` — TRUE/FALSE. | 0 | 2 | 1 | 0 |
| `Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS` | Для Inco: SUM(`Repair Length (mm)`)/SUM(`Rej Length`) (у Inco это RT Length) за 15 дней. | 0 | 4 | 2 | 1 |
| `Inco Rej Rate % STATUS for Welder by Length Last 2 Weeks` | Светофор 0-1.5 / 1.5-2 / >2 % для Inco. | 0 | 9 | 4 | 0 |
| `Inco Length Ratio % "PR all" For Welder LAST 1 Month` | То же за 30 дней. | 0 | 2 | 1 | 1 |
| `Inco Rej Rate % STATUS for Welder by Length Last 1 Month` | Светофор для окна 1 месяц (Inco). | 0 | 4 | 2 | 0 |

<details><summary>DAX (verbatim, 28 колонок)</summary>

```dax
-- ===== UT Report "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[UT Report] <> "", 
    'Project WD+WR+INCO+Acciona'[UT Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC", 
        LOOKUPVALUE(
            'UT TRACKER (CCC)_Talisman'[UT1 REP NO],
            'UT TRACKER (CCC)_Talisman'[Joint ID], 
            'Project WD+WR+INCO+Acciona'[Joint ID]
        ), 
        IF(
            'Project WD+WR+INCO+Acciona'[RT/UT] = "UT",
            'Project WD+WR+INCO+Acciona'[RT Report],
            BLANK()
        )
    )
)

-- ===== UT Date "PR All" =====
IF(
    'Project WD+WR+INCO+Acciona'[UT Date]>0, 
    'Project WD+WR+INCO+Acciona'[UT Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC", 
        LOOKUPVALUE(
            'UT TRACKER (CCC)_Talisman'[UT1 DATE],
            'UT TRACKER (CCC)_Talisman'[Joint ID], 
            'Project WD+WR+INCO+Acciona'[Joint ID]
        ), 
        IF(
            'Project WD+WR+INCO+Acciona'[RT/UT] = "UT",
            'Project WD+WR+INCO+Acciona'[RT Date],
            BLANK()
        )
    )
)

-- ===== UT Operator ID. =====
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerGACID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "GAC",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Operator ID]),
                'Project WD+WR+INCO+Acciona'[UT Operator ID],
                'Project WD+WR+INCO+Acciona'[UT Operator ID]
            )
        )
    )
VAR UTTrackerTEKID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "TEKFEN",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Operator ID]),
                'Project WD+WR+INCO+Acciona'[UT Operator ID],
                'Project WD+WR+INCO+Acciona'[UT Operator ID]
            )
        )
    )
VAR UTTrackerINCOID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Operator ID]),
                'Project WD+WR+INCO+Acciona'[UT Operator ID],
                'Project WD+WR+INCO+Acciona'[UT Operator ID]
            )
        )
    )
VAR UTTrackerCCCID = 
CALCULATE(
        LOOKUPVALUE('UT TRACKER (CCC)_Talisman'[UT Operator ID.], 'UT TRACKER (CCC)_Talisman'[Joint ID], CurrentJointID),
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        'Project WD+WR+INCO+Acciona'[RT/UT] = "UT"
            )
RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
            IF(
                NOT ISBLANK(UTTrackerINCOID),
                UTTrackerINCOID,
                IF(
                    NOT ISBLANK(UTTrackerCCCID),
                    UTTrackerCCCID,
                    BLANK()
                )
            )
        )
    )

-- ===== Manual UT Date. =====
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerGACID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "GAC",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Date "PR All"]),
                'Project WD+WR+INCO+Acciona'[Manual UT Date],
                'Project WD+WR+INCO+Acciona'[UT Date "PR All"]
            )
        )
    )
VAR UTTrackerTEKID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "TEKFEN",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Date "PR All"]),
                'Project WD+WR+INCO+Acciona'[Manual UT Date],
                'Project WD+WR+INCO+Acciona'[UT Date "PR All"]
            )
        )
    )
VAR UTTrackerINCOID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Date "PR All"]),
                'Project WD+WR+INCO+Acciona'[UT Date],
                'Project WD+WR+INCO+Acciona'[UT Date "PR All"]
            )
        )
    )
VAR UTTrackerCCCID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Date "PR All"]),
                'Project WD+WR+INCO+Acciona'[UT Date "PR All"],
                'Project WD+WR+INCO+Acciona'[UT Date "PR All"]
            )
        )
    )

RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
            IF(
                NOT ISBLANK(UTTrackerINCOID),
                UTTrackerINCOID,
                IF(
                    NOT ISBLANK(UTTrackerCCCID),
                    UTTrackerCCCID,
                    BLANK()
                )
            )
        )
    )

-- ===== Manual UT Report No. =====
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerGACID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "GAC",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Report "PR All"]),
                'Project WD+WR+INCO+Acciona'[Manual UT Report No],
                'Project WD+WR+INCO+Acciona'[UT Report "PR All"]
            )
        )
    )

VAR UTTrackerTEKID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "TEKFEN",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Report "PR All"]),
                'Project WD+WR+INCO+Acciona'[Manual UT Report No],
                'Project WD+WR+INCO+Acciona'[UT Report "PR All"]
            )
        )
    )

VAR UTTrackerINCOID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Report "PR All"]),
                'Project WD+WR+INCO+Acciona'[UT Report],
                'Project WD+WR+INCO+Acciona'[UT Report "PR All"]
            )
        )
    )

VAR UTTrackerCCCID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Report "PR All"]),
                'Project WD+WR+INCO+Acciona'[UT Report "PR All"],
                'Project WD+WR+INCO+Acciona'[UT Report "PR All"]
            )
        )
    )

RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
                    IF(
            NOT ISBLANK(UTTrackerINCOID),
            UTTrackerINCOID,
            IF(
                NOT ISBLANK(UTTrackerCCCID),
                UTTrackerCCCID,
                BLANK()
            )
        )
    )
    )

-- ===== Manual UT Status. =====
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR CurrentWelderID = 'Project WD+WR+INCO+Acciona'[Welder ID]

VAR UTTrackerGACID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "GAC",
        IF(
            ISBLANK(LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID)),
            LOOKUPVALUE('Project WD+WR+INCO+Acciona'[Manual UT Status], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID),
            LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID)
        )
    )

VAR UTTrackerTEKID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "TEKFEN",
        IF(
            ISBLANK(LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID)),
            LOOKUPVALUE('Project WD+WR+INCO+Acciona'[Manual UT Status], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID),
            LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID)
        )
    )

VAR UTTrackerINCOI
    /* … обрезано: полный текст в analysis/pbix/raw/prall-columns.json */

-- ===== Inspected Length(MM). =====
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR MaxInspectedLengthFromGAC = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "GAC" && 'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        'Project WD+WR+INCO+Acciona'[Weld Length "PR all"],
        BLANK()
    )
VAR MaxInspectedLengthFromTEK = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "TEKFEN" && 'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        'Project WD+WR+INCO+Acciona'[Weld Length "PR all"],
        BLANK()
    )
VAR MaxInspectedLengthFromCCC = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC" && 'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        'Project WD+WR+INCO+Acciona'[Weld Length "PR all"],
        BLANK()
    )
VAR MaxInspectedLengthFromOthers = 
    IF(
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        CALCULATE(
            MAX('Project WD+WR+INCO+Acciona'[Weld Length "PR all"]),
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "GAC" &&
                'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "TEKFEN" &&
                'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC" &&
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            )
        ),
        BLANK()
    )
RETURN
    IF(
        NOT ISBLANK(MaxInspectedLengthFromGAC),
        MaxInspectedLengthFromGAC,
        IF(
            NOT ISBLANK(MaxInspectedLengthFromTEK),
            MaxInspectedLengthFromTEK,
            IF(
                NOT ISBLANK(MaxInspectedLengthFromCCC),
                MaxInspectedLengthFromCCC,
                MaxInspectedLengthFromOthers
            )
        )
    )

-- ===== Defect Length(MM). =====
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerCCCID = 
    CALCULATE(
        LOOKUPVALUE('UT TRACKER (CCC)_Talisman'[Defect Lenght(MM).],'UT TRACKER (CCC)_Talisman'[Joint ID], CurrentJointID),
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        'Project WD+WR+INCO+Acciona'[RT/UT] = "UT"
    )
RETURN
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco" && 
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        'Project WD+WR+INCO+Acciona'[Repair Length (mm)]/1000,
        IF(
            'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "" && 
            'Project WD+WR+INCO+Acciona'[By UT] = "Y",
            'Project WD+WR+INCO+Acciona'[Rej Length],
            IF(
                'Project WD+WR+INCO+Acciona'[Manual UT Status.] = "R" &&
                'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
                UTTrackerCCCID,
                0
            )
        )
    )

-- ===== Weld Length "PR all" =====
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco" &&
    'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
    'Project WD+WR+INCO+Acciona'[Weld Length] / 1000,
    IF(
        ISBLANK(
            LOOKUPVALUE(
                'Weld Length'[Weld Length],
                'Weld Length'[Dia inch], 
                'Project WD+WR+INCO+Acciona'[Dia inch]
            )
        ),
        BLANK(),
        LOOKUPVALUE(
            'Weld Length'[Weld Length],
            'Weld Length'[Dia inch], 
            'Project WD+WR+INCO+Acciona'[Dia inch]
        )
    )
)

-- ===== Cross Verification-by CTJV (TPI). =====
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerGACID = 
    CALCULATE(
        MAXX(
            FILTER(
                'UT TRACKER (GAC)',
                'UT TRACKER (GAC)'[Joint ID] = CurrentJointID
            ),
            'UT TRACKER (GAC)'[Cross Verification-by  CTJV (TPI) ]
        ),
        'UT TRACKER (GAC)'[Cross Verification-by  CTJV (TPI) ] <> BLANK()
    )
VAR UTTrackerTEKID = 
    CALCULATE(
        MAXX(
            FILTER(
                'UT TRACKER (TEK)',
                'UT TRACKER (TEK)'[Joint ID] = CurrentJointID
            ),
            'UT TRACKER (TEK)'[Cross Verification-by  CTJV (TPI) ]
        ),
        'UT TRACKER (TEK)'[Cross Verification-by  CTJV (TPI) ] <> BLANK()
    )
RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
            BLANK()
        )
    )

-- ===== CTJV VERIFICATION Date. =====
CALCULATE(
    MAXX(
        FILTER(
            'UT TRACKER (GAC)',
            'UT TRACKER (GAC)'[Joint ID] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
        ),
        'UT TRACKER (GAC)'[CTJV VERIFICATIONDATE]
    )+
    CALCULATE(
    MAXX(
        FILTER(
            'UT TRACKER (TEK)',
            'UT TRACKER (TEK)'[Joint ID] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
        ),
        'UT TRACKER (TEK)'[CTJV VERIFICATIONDATE]
)))

-- ===== CTJV VERIFICATION BY. =====
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerGACID = 
    CALCULATE(
        MAXX(
            FILTER(
                'UT TRACKER (GAC)',
                'UT TRACKER (GAC)'[Joint ID] = CurrentJointID
            ),
            'UT TRACKER (GAC)'[CTJV VERIFICATIONBY]
        ),
        'UT TRACKER (GAC)'[CTJV VERIFICATIONBY] <> BLANK()
    )
VAR UTTrackerTEKID = 
    CALCULATE(
        MAXX(
            FILTER(
                'UT TRACKER (TEK)',
                'UT TRACKER (TEK)'[Joint ID] = CurrentJointID
            ),
            'UT TRACKER (TEK)'[CTJV VERIFICATIONBY]
        ),
        'UT TRACKER (TEK)'[CTJV VERIFICATIONBY] <> BLANK()
    )
RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
            BLANK()
        )
    )

-- ===== UT Rej Length Rate % "PR all" For Welder =====
IF (
    NOT ISBLANK('Project WD+WR+INCO+Acciona'[Manual UT Date.]),
    DIVIDE(
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Defect Length(MM).]),
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
        ),
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Inspected Length(MM).]),
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
        )
    ) * 1,
    BLANK()
)

-- ===== UT Rej Rate % STATUS for Welder by Length =====
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] >= 0 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] < 0.015,
        "1. Ok: 0 to 1.5%",
        IF (
            'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] >= 0.015 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] < 0.02,
            "2. Monitor: 1.5% to 2%",
            IF (
                'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] >= 0.02 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] <= 1,
                "3. Action: 2% to 100%",
                BLANK()
            )
        )
    )
)

-- ===== UT Rej Rate % "PR all" For Welder by Joint =====
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <>"",'Project WD+WR+INCO+Acciona'[Manual UT Status.]= "R",
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Welder ID])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <>"",
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Welder ID])
    )
) * 1

-- ===== UT Rej Rate % STATUS for Welder by Joint =====
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[UT Rej Rate % "PR all" For Welder by Joint]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[UT Rej Rate % "PR all" For Welder by Joint] >= 0 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % "PR all" For Welder by Joint] < 0.1,
        "1. 0 to 10%",
        IF (
            'Project WD+WR+INCO+Acciona'[UT Rej Rate % "PR all" For Welder by Joint] >= 0.1 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % "PR all" For Welder by Joint] <= 1,
            "2. 10 to 100%",
            BLANK()
        )
    )
)

-- ===== UT Rej Rate % by joint "PR all" For Sub-Con =====
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <>"",'Project WD+WR+INCO+Acciona'[Manual UT Status.]= "R",
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Sub-Contractor])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <>"",
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Sub-Contractor])
    )
) * 1

-- ===== UT Rej Rate % STATUS for Sub-Con by Joint =====
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] >= 0 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] < 0.03,
        "1. ok-0 to 3%",
        IF (
            'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] >= 0.03 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] < 0.05,
            "2. Monitor-3% to 5%",
            IF (
                'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] >= 0.05 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] <= 1,
                "3. Not Accept-5% to 100%",
                BLANK()
            )
        )
    )
)

-- ===== UT Rej Rate % by Length "PR all" For Sub-Con =====
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Defect Length(MM).]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Sub-Contractor])
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Inspected Length(MM).]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Sub-Contractor])
    )
) * 1

-- ===== UT Rej Rate % STATUS for Sub-Con by Length =====
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] >= 0 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] < 0.01,
        "1.ok: 0 to 1%",
        IF (
            'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] >= 0.01 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] < 0.015,
            "2.Monitor: 1% to 1.5%",
            IF (
                'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] >= 0.015 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] <= 1,
                "3.Not Accept: 1.5% to 100%",
                BLANK()
            )
        )
    )
)

-- ===== UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS =====
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Defect Length(MM).]),
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last UT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}
        )
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Inspected Length(MM).]),'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last UT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}
        )
    )
)

-- ===== UT Rej Rate % STATUS for Welder by Length Last 2 Weeks =====
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.015,
        "1.Ok: 0 to 1.5%",
        IF (
            'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.015 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.02,
            "2.Monitor: 1.5% to 2%",
            IF (
                'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.02 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] <= 1,
                "3.Action: 2% to 100%",
                BLANK()
            )
        )
    )
)

-- ===== UT Ratio % For Welder (<5% ; >5%) "PR all" =====
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    )
) * 1

-- ===== UT Status TR/FL =====
IF(
    'Project WD+WR+INCO+Acciona'[UT Acc/Rej] = 'Project WD+WR+INCO+Acciona'[Manual UT Status],
    "TRUE",
    "FALSE"
)

-- ===== Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS =====
IF(
    NOT ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"]),
    
    VAR RepairLength = 
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Repair Length (mm)]),
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor]="Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
            )
        )

    VAR WeldLength = 
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Rej Length]), --Все верно это RT Length Column
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor]="Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
            )
        )

    RETURN
        DIVIDE(RepairLength, WeldLength),

    BLANK()  -- Возвращает пустое значение, если Last_RT Date "PR all" пустое
)

-- ===== Inco Rej Rate % STATUS for Welder by Length Last 2 Weeks =====
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.015,
        "1. 0 to 1.5% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.015 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.02,
            "2.Monitor: 1.5% to 2%",
            IF (
                'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.02 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] <= 1,
                "3.Action: 2% to 100%",
                BLANK()
            )
        )
    )
)

-- ===== Inco Length Ratio % "PR all" For Welder LAST 1 Month =====
IF(
    NOT ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"]),
    
    VAR RepairLength = 
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Repair Length (mm)]),
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor]="Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}
            )
        )

    VAR WeldLength = 
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Rej Length]), --Все верно это RT Length Column
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor]="Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}
            )
        )

    RETURN
        DIVIDE(RepairLength, WeldLength),

    BLANK()  -- Возвращает пустое значение, если Last_RT Date "PR all" пустое
)

-- ===== Inco Rej Rate % STATUS for Welder by Length Last 1 Month =====
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] >= 0 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] < 0.015,
        "1. 0 to 1.5% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] >= 0.015 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] < 0.02,
            "2.Monitor: 1.5% to 2%",
            IF (
                'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] >= 0.02 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] <= 1,
                "3.Action: 2% to 100%",
                BLANK()
            )
        )
    )
)

```

</details>

#### 2.2.6 Кросс-сверка отчётов с реестром `l2_ndt_list` (11)

| колонка | смысл | мер | виз | стр | калк |
|---|---|---:|---:|---:|---:|
| `RT CROSS CHECK PRJ Data & FRB` | Есть ли `RT Report` в реестре `l2_ndt_list` (Report_Type="RT"); иначе "NOT Found". | 5 | 4 | 2 | 0 |
| `MT CROSS CHECK PRJ Data & FRB` | То же для `MT Report "PR All"`. | 5 | 5 | 2 | 0 |
| `PWHT CROSS CHECK PRJ Data & FRB` | То же для `PWHT Report "PR All"`. | 5 | 4 | 2 | 0 |
| `UT CROSS CHECK PRJ Data & FRB` | То же для `Manual UT Report No.`. | 5 | 4 | 2 | 0 |
| `PMI CROSS CHECK PRJ Data & FRB` | То же для `PMI Report "PR All"`. | 5 | 4 | 2 | 0 |
| `PT CROSS CHECK PRJ Data & FRB` | То же для `PT Report "PR All"`. | 5 | 4 | 2 | 0 |
| `HT CROSS CHECK PRJ Data & FRB` | То же для `HT Report "PR All"`. | 5 | 4 | 2 | 0 |
| `ORIF CROSS CHECK PRJ Data & FRB` | То же для `ORIF Report`. | 5 | 5 | 2 | 0 |
| `PADLT CROSS CHECK PRJ Data & FRB` | То же для `PADLT Report`. | 5 | 4 | 2 | 0 |
| `VI CROSS CHECK PRJ Data & FRB` | То же для `DWIR Report "PR All"` (визуальный контроль). | 5 | 4 | 2 | 0 |
| `VBT CROSS CHECK PRJ Data & FRB` | То же для `VBT Report` (только Inco). | 2 | 0 | 0 | 0 |

<details><summary>DAX (verbatim, 11 колонок)</summary>

```dax
-- ===== RT CROSS CHECK PRJ Data & FRB =====
VAR RTReport = 'Project WD+WR+INCO+Acciona'[RT Report]
RETURN
    IF (
        'Project WD+WR+INCO+Acciona'[RT/UT] <> "UT" && 'Project WD+WR+INCO+Acciona'[Manual UT Report No.] = "" &&
        RTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = RTReport &&
                'l2_ndt_list'[Report_Type] = "RT"
            )
        RETURN
            IF (
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ),
        BLANK()
    )

-- ===== MT CROSS CHECK PRJ Data & FRB =====
VAR MTReport = 'Project WD+WR+INCO+Acciona'[MT Report "PR All"]
RETURN
    IF (
        MTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = MTReport &&
                'l2_ndt_list'[Report_Type] = "MT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ),
        BLANK()
    )

-- ===== PWHT CROSS CHECK PRJ Data & FRB =====
VAR PWHTReport = 'Project WD+WR+INCO+Acciona'[PWHT Report "PR All"]
RETURN
    IF (
        PWHTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = PWHTReport &&
                'l2_ndt_list'[Report_Type] = "PWHT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )

-- ===== UT CROSS CHECK PRJ Data & FRB =====
VAR UTReport = 'Project WD+WR+INCO+Acciona'[Manual UT Report No.]
RETURN
    IF (
        UTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = UTReport &&
                'l2_ndt_list'[Report_Type] = "UT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )

-- ===== PMI CROSS CHECK PRJ Data & FRB =====
VAR PMIReport = 'Project WD+WR+INCO+Acciona'[PMI Report "PR All"]
RETURN
    IF (
        PMIReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = PMIReport &&
                'l2_ndt_list'[Report_Type] = "PMI"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )

-- ===== PT CROSS CHECK PRJ Data & FRB =====
VAR PTReport = 'Project WD+WR+INCO+Acciona'[PT Report "PR All"]
RETURN
    IF (
        PTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = PTReport &&
                'l2_ndt_list'[Report_Type] = "PT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )

-- ===== HT CROSS CHECK PRJ Data & FRB =====
VAR HTReport = 'Project WD+WR+INCO+Acciona'[HT Report "PR All"]
RETURN
    IF (
        HTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = HTReport &&
                'l2_ndt_list'[Report_Type] = "HT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )

-- ===== ORIF CROSS CHECK PRJ Data & FRB =====
VAR ORIFReport = 'Project WD+WR+INCO+Acciona'[ORIF Report]
RETURN
    IF (
        ORIFReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = ORIFReport &&
                'l2_ndt_list'[Report_Type] = "ORIF"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )

-- ===== PADLT CROSS CHECK PRJ Data & FRB =====
VAR PADLTReport = 'Project WD+WR+INCO+Acciona'[PADLT Report]
RETURN
    IF (
        PADLTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = PADLTReport &&
                'l2_ndt_list'[Report_Type] = "PADLT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )

-- ===== VI CROSS CHECK PRJ Data & FRB =====
VAR VIReport = 'Project WD+WR+INCO+Acciona'[DWIR Report "PR All"]
RETURN
    IF (
        VIReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = VIReport &&
                'l2_ndt_list'[Report_Type] = "VI"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )

-- ===== VBT CROSS CHECK PRJ Data & FRB =====
VAR VBTReport = 'Project WD+WR+INCO+Acciona'[VBT Report]
RETURN
    IF (
        VBTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = VBTReport &&
                'l2_ndt_list'[Report_Type] = "VBT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )

```

</details>

#### 2.2.7 Тест-пакеты и пунш-листы (8)

| колонка | смысл | мер | виз | стр | калк |
|---|---|---:|---:|---:|---:|
| `TP Ratio % Complete "PR all"` | Готовность тест-пакета: сваренные стыки / все стыки пакета. | 0 | 0 | 0 | 1 |
| `TP Ratio % STATUS` | Бакеты 0-50 / 50-80 / 80-99 / 100 %. | 0 | 1 | 1 | 0 |
| `TP Complete %` | То же, но исключая ремонты (`Repair & Reweld "PR all"`=""). | 0 | 1 | 1 | 0 |
| `Open_Punch_"X"` | Открытые пунш-листы категории X из `Testpack-wise Details Report` по тест-пакету. | 1 | 1 | 1 | 0 |
| `Open_Punch_"Y"` | То же, категория Y. | 1 | 1 | 1 | 0 |
| `Open_Punch_"Z"` | То же, категория Z. | 1 | 1 | 1 | 0 |
| `Reinstatement_Date` | Дата reinstatement тест-пакета из `Testpack-wise Details Report`. | 0 | 4 | 3 | 0 |
| `Task_Status PIP-018-A "VPR"` | Закрыта ли задача PIP-018-A в `SCDB Data l0_scdb_task` по тегу тест-пакета. Один визуал, ни одной меры. | 0 | 1 | 1 | 0 |

<details><summary>DAX (verbatim, 8 колонок)</summary>

```dax
-- ===== TP Ratio % Complete "PR all" =====
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"])
    )
) * 1

-- ===== TP Ratio % STATUS =====
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] >= 0 && 'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] < 0.5,
        "1. 0 to 50%",
        IF (
            'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] >= 0.5 && 'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] < 0.8,
            "2. 50 to 80%",
            IF (
                'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] >= 0.8 && 'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] < 0.99,
                "3. 80 to 99%",
                IF (
                    'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] >= 0.99 && 'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] <= 1,
                    "4. 100%",
                    BLANK()
                )
            )
        )
    )
)

-- ===== TP Complete % =====
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",'Project WD+WR+INCO+Acciona'[Weld Date]>0,
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"])
    )
) * 1

-- ===== Open_Punch_"X" =====
    VAR Open_Punch_X = 
        MAXX(
            FILTER(
                'Testpack-wise Details Report', 
                'Testpack-wise Details Report'[TEST PACK] = 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]
            ),
            'Testpack-wise Details Report'[Open_Punch "X"]
        )
    RETURN Open_Punch_X

-- ===== Open_Punch_"Y" =====
    VAR Open_Punch_Y = 
        MAXX(
            FILTER(
                'Testpack-wise Details Report', 
                'Testpack-wise Details Report'[TEST PACK] = 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]
            ),
            'Testpack-wise Details Report'[Open_Punch "Y"]
        )
    RETURN Open_Punch_Y

-- ===== Open_Punch_"Z" =====
    VAR Open_Punch_Z = 
        MAXX(
            FILTER(
                'Testpack-wise Details Report', 
                'Testpack-wise Details Report'[TEST PACK] = 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]
            ),
            'Testpack-wise Details Report'[Open_Punch "Z"]
        )
    RETURN Open_Punch_Z

-- ===== Reinstatement_Date =====
    VAR Reinstatement_Date = 
        MAXX(
            FILTER(
                'Testpack-wise Details Report', 
                'Testpack-wise Details Report'[TEST PACK] = 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]
            ),
            'Testpack-wise Details Report'[Reinstatement Completed Date]
        )
    RETURN Reinstatement_Date

-- ===== Task_Status PIP-018-A "VPR" =====
VAR Task_Status = 
    MAXX(
        FILTER(
            'SCDB Data l0_scdb_task', 
            'SCDB Data l0_scdb_task'[TAG] = 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]
        ),
        // Возвращаем "Closed" (1), только если статус действительно "closed"
        IF('SCDB Data l0_scdb_task'[Task_Status] = "Closed", 1, 0)
    )

RETURN 
    // Если MAXX нашла хотя бы одно "closed" (т.е. вернула 1), 
    // возвращаем текст "Closed", иначе BLANK()
    IF(Task_Status = 1, "Closed", BLANK())

```

</details>

#### 2.2.8 Флаги-классификаторы и исключения (8)

| колонка | смысл | мер | виз | стр | калк |
|---|---|---:|---:|---:|---:|
| `TMCP Pipe` | `Service class`="9C3AQN" и `Dia inch` ∈ {30,34,46} → "TMCP Pipe". В "WD"-варианте только 46. | 1 | 68 | 14 | 0 |
| `Temporary Lines` | `RIGHT(ISO Number,4)`="-PCC" → временная линия (исключается из прогресса). | 0 | 3 | 3 | 0 |
| `Stainless steel` | `Material Type` содержит SS/DSS/SDSS → "Stainless Steel". | 0 | 3 | 2 | 0 |
| `Bracing` | Есть ли `Spool ID` в `Bracing FE_Analysis[ISO/SPOOL]`. | 0 | 2 | 1 | 0 |
| `Exlude Full Cut & Debris` | `RT Re-Shoot Status`="Full Cut" и причина содержит "Debris" и `Defect Code`="XX" → исключить плёнки. | 17 | 0 | 0 | 0 |
| `Exlude RT Films from UT` | `By UT`="Y", не Inco, `RT Report` содержит "UT" и есть плёнки → исключить плёнки из RT-статистики. | 4 | 0 | 0 | 0 |
| `Status WPQ Welding Process` | Процесс сварки из `WPQ WELDING PROCESS` по `WPS No.`. | 0 | 4 | 4 | 0 |
| `Status WPQ Type of Welding Machine` | Тип сварочного аппарата из `WPQ WELDING PROCESS` по `WPS No.`. | 0 | 6 | 4 | 0 |

<details><summary>DAX (verbatim, 8 колонок)</summary>

```dax
-- ===== TMCP Pipe =====
    IF('Project WD+WR+INCO+Acciona'[Service class]="9C3AQN" &&
    'Project WD+WR+INCO+Acciona'[Dia inch]IN{30, 34, 46},
    "TMCP Pipe")

-- ===== Temporary Lines =====
IF (
    RIGHT('Project WD+WR+INCO+Acciona'[ISO Number], 4) = "-PCC",
    "Temporary Lines",
    BLANK()
)

-- ===== Stainless steel =====
IF (
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[Material Type], "SS") ||
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[Material Type], "DSS") ||
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[Material Type], "SDSS"),
    "Stainless Steel",
    BLANK()
)

-- ===== Bracing =====
    VAR Bracing = 
        MAXX(
            FILTER(
                'Bracing FE_Analysis', 
                'Bracing FE_Analysis'[ISO/SPOOL] = 'Project WD+WR+INCO+Acciona'[Spool ID]
            ),
            'Bracing FE_Analysis'[ISO/SPOOL]
        )
    RETURN Bracing

-- ===== Exlude Full Cut & Debris =====
IF (
    'Project WD+WR+INCO+Acciona'[RT Re-Shoot Status] = "Full Cut" && 
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[RT Re-Shoot Reason], "Debris") &&
    'Project WD+WR+INCO+Acciona'[Defect Code] = "XX",
    "Exclude Films:Debris",
    BLANK()
)

-- ===== Exlude RT Films from UT =====
IF (
    // 1. Общие условия (должны выполняться всегда)
    'Project WD+WR+INCO+Acciona'[By UT] = "Y" && 
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "Inco" &&
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[RT Report], "UT") &&
    
    // 2. Условие "ИЛИ" (скобки обязательны!)
    (
        'Project WD+WR+INCO+Acciona'[Total No of films Rej] > 0 || 
        'Project WD+WR+INCO+Acciona'[RT Film Total] > 0
    ),
    
    "Exclude UT Films",
    BLANK()
)

-- ===== Status WPQ Welding Process =====
MAXX(
    FILTER(
        ALL('WPQ WELDING PROCESS'),
        'WPQ WELDING PROCESS'[WPS No.] = 'Project WD+WR+INCO+Acciona'[WPS No.]
    ),
    'WPQ WELDING PROCESS'[Welding process]
)

-- ===== Status WPQ Type of Welding Machine =====
MAXX(
    FILTER(
        ALL('WPQ WELDING PROCESS'),
        'WPQ WELDING PROCESS'[WPS No.] = 'Project WD+WR+INCO+Acciona'[WPS No.]
    ),
    'WPQ WELDING PROCESS'[Type of Welding Machine]
)

```

</details>


### 2.3 Мёртвые колонки и висячие ссылки

**Вычисляемые колонки, не используемые нигде (17 из 158)** — ни в одной мере, ни в одном
визуале, ни в другой вычисляемой колонке:

`% of Total Reject`, `Joint Uniq "PR all" Column`, `Report TYPE`,
`UT Ratio % For Welder (<5% ; >5%) "PR all"`, `Cross Verification-by CTJV (TPI).`,
`CTJV VERIFICATION Date.`, `CTJV VERIFICATION BY.`, `PMI % "PR All"`, `HT % "PR All"`,
`LINE`, `Days Since First Weld`,
`QTY Welder ID & No RT by Service Class + Service Cat+NDT Remarks`, `Has_RT_Report`,
`Status Fabricated from "WD"`, `Status Spool NDE from "WD"`, `Last Spool Status from "WD"`,
`Days Between RT Selected and RT Date`.

Три из них (`Status … from "WD"`) — это `MAXX(FILTER(ALL('Weld Dump'), … ))` по `Joint ID`
на 6,5 млн строк: если их когда-нибудь включат в визуал, модель встанет. Портировать не надо.

**Импортированные колонки, не используемые нигде: 179 из 267** (67 %). Это весь хвост
`* Selected By` / `* Exam Req No` / `* Exam Req By` (30 колонок), весь блок `FN`, `PADLT`,
`ORIF`, вся прослеживаемость материала (`GROUP-*`, `IDENT CODE-*`, `TRAC NO-*`, `Part *`),
весь блок логистики (`SHIPMENT *`, `EREC *`, `PIP-001-A`, `W24DWIR`, `BHS`, `WHS`,
`PACKING LIST NO`) и все `Custom3…Custom14`. В нашей схеме 29 из них уже отброшены как
пустые во всех строках дампа (`db/migrations/0003_weld.sql`, шапка).

**Ссылки на колонки, отсутствующие в модели.** Систематическая проверка всех 158 выражений
(разбор `'Table'[Col]` и `[Col]`) даёт **четыре** флага, из которых три — ложные:

| колонка | ссылка | вердикт |
|---|---|---|
| `CROSS CHECK DATA & Talisman JOINT ID` | `'…'[Sub-contractor]` (×2) | регистр не совпадает с `Sub-Contractor`; DAX регистронезависим → работает |
| `HA` | `'…'[System No]` | в модели `System no`; DAX регистронезависим → работает |
| `Week_End_Date from Calendar` | `'Calendar'[Date]` | **`columns.json` не содержит колонки `Date` у таблицы `Calendar`** — там перечислены 9 вычисляемых колонок (`Month`, `Row Index Column`, `Name_of_the_Month`, `Week_Start_Date`, `Weekday`, `Weeknum`, `Week_End_Date`, `YEAR`, `Date2`). `Calendar` — calculated table `CALENDAR("5/8/2021","31/12/2026")`, и функция `CALENDAR` порождает колонку `Date` неявно; pbixray её просто не отдаёт. То есть ссылка почти наверняка валидна, но **из метаданных это не подтверждается** — при портировании считать `Calendar[Date]` = сгенерированной датой календаря. |

Отдельно: `Days Since Last Weld`, `Days Since Last RT`, `Days Since Last UT`,
`Days Since First Weld` ссылаются на `[Cur_Date "PR all"]` — это **мера**, а не колонка
(`Calendar[Cur_Date "PR all"]`). Вычисляемая колонка, зависящая от меры с `TODAY()`, — это
значение, замороженное на момент refresh. В нашей схеме это `:as_of` параметр (`lib/db.ts`).

---

## 3. Статистика колонок

`column-statistics.json` даёт по каждой из 425 колонок только `Cardinality` (число различных
значений), `Dictionary`, `HashIndex` и `DataSize`. **Минимумов/максимумов и списков значений
в нём нет** — таблица ниже поэтому про мощность словаря, а не про сами значения; конкретные
словари (`Sub-Contractor` = 6 значений и т. д.) приходится читать из исходных файлов
(`analysis/dump/profile.md` §5.0a/§5.0b и `analysis/sources2/profile.md`).

Все цифры — на **замороженный refresh 2026-08-30 11:03 UTC** (максимум `ModifiedTime` по
статистикам колонок этой таблицы; в `Settings.json` дата refresh не записана,
`Metadata.json` даёт только `CreatedFromRelease: 2026.08`). Последняя дата сварки в данных —
2026-08-28, потому что M явно выкидывает 29 и 30 августа 2026.

30 наиболее информативных колонок:

| колонка | cardinality | что это значит |
|---|---:|---|
| `Index` | 6 546 261 | = числу строк; подтверждает row count |
| `Joint ID` | 2 390 991 | уникальных стыков (с учётом `Repair Suffix`) на все 6 источников |
| `Joint ID for Heat N` | 2 390 974 | на 17 меньше — коллизии ISO+Weld без Spool |
| `CROSS CHECK DATA & Talisman JOINT ID` | 1 469 921 | стыки CCC, найденные в `TALISMAN DATA` |
| `DWIR Report "PR All"` | 557 690 | номера сварочных рапортов |
| `Spool ID` | 521 877 | катушек |
| `TESTPACK No "PR All"` | 29 456 | тест-пакетов после подстановки CCC (против 17 875 в сыром `Testpack No`) |
| `RT Report` | 207 405 | RT-отчётов |
| `ISO Number` | 89 536 | изометрий |
| `Welder ID` | 3 940 | сварщиков; `Welder` = 3 896, то есть 44 пары «табельный номер × субподрядчик» схлопывались бы при группировке по `Welder` |
| `Weld Date` | 1 639 | различных дат сварки |
| `RT Date` | 1 510 | различных дат RT |
| `Subsystem Code` | 1 449 | подсистем |
| `Location of Defect` | 1 013 | свободный текст, не словарь |
| `Service Class + Service Cat+NDT Remarks` | 948 | ключ NDE-страниц |
| `PDS Area` | 644 | зон |
| `Weld Length` | 579 | значений длины (метры) |
| `System no` | 539 | систем |
| `Thickness` | 345 | толщин |
| `WPS No.` | 290 | процедур сварки |
| `Service class` | 250 | классов сервиса |
| `Rej Length` | 246 | значений длины брака |
| `RT Film Total` | 167 | плёнок на стык (максимум) |
| `Material Type` | 90 | марок материала |
| `Dia inch` | 81 | диаметров |
| `Service Cat` | 50 | категорий сервиса |
| `Defect Code` | 46 | кодов дефектов |
| `2 weeks Period for RT` | 37 | двухнедельных окон |
| `Rework Code` | 23 | кодов переделки |
| `Weld Type` | 22 | типов шва (после схлопывания RPD*/SOB*) |
| `Area Classification` | 22 | классов зоны |
| `Total No of films Rej` | 20 | 0…19 забракованных плёнок на стык |
| `RT Weld Status` | 12 | в дампе 10 (`NR`,`HS`,`?`,`H`,`S`,`SS`,`T2-1`,`T1S`,`T1`,`T2S`); +2 добавляет формула CCC — `HS CCC` и `T` (§1.5) |
| `Repair Suffix` | 10 | R1/R2/RW1/RS1/… |
| `Tracer Shot` | 9 | |
| `YearRT` | 7 | 2020…2026 |
| `Sub-Contractor` | **6** | CCC, GAC, TEKFEN, MEDGULF, Acciona, Inco |
| `RT%` | **6** | `0`, `5`, `10`, `20`, `30`, `100` (по `analysis/dump/profile.md` §362) — это и есть разбиение страниц мокапа |
| `Report TYPE` | 6 | RT/UT/PT/PMI/PWHT/MT |
| `Weld Point Code` | 5 | R/H/F/C… (только CCC) |
| `NDT Remarks` | 5 | только CCC/Acciona |
| `PT%` | 5 | |
| `HA` | 4 | HA1…HA4 |
| `RT Acc/Rej` | **4** | в дампе три значения — `A`, `R`, `RS` (`profile.md` §5.0a); четвёртое приходит из CCC и по DAX-фильтрам это `U/Review`. `RS` и `U/Review` и ломают наивный порт (`calculation-logic.md` §0.2) |
| `PWHT Y/N` | 4 | Y / N / 25.01 / пусто (ruling R-04) |
| `Original Joint` | 4 | |
| `Repair & Reweld "PR all"` | 4 | Repair / Reweld / RS1 / пусто |
| `Train SG` | 4 | |
| `Manual UT Status` / `Manual UT Status.` | 3 | A / R / пусто |
| `RT/UT` | 3 | RT / UT / пусто |
| `Weld Cat` | 3 | F / S / пусто |
| `PWHT Status PR ALL` | 3 | Y / N / 25.01 |
| `PMI%` | 3 | |
| `UT Acc/Rej` | 3 | |
| `HT%`, `MT Acc/Rej`, `PWHT Y/N CCC`, `PWHT Y/N CCC (NEW)`, `Dia Inch >20<`, `Spool ID Status` | 2 | |
| `UT%`, `FN%`, `TMCP Pipe`, `Temporary Lines`, `Stainless steel`, `Bracing`, `Exlude Full Cut & Debris`, `Exlude RT Films from UT`, `By UT All`, `Task_Status PIP-018-A "VPR"` | **1** | одно значение на всю таблицу |

Про cardinality = 1 надо сказать отдельно, потому что это ловушка:

* `UT%` и `FN%` имеют `DataSize` 1 192 байта — это **пустая** колонка. `UT%` заполняется
  только в `Weld Dump`, и в объединении она вытеснена; весь UT в «PR all» идёт через
  вычисляемые `UT Report "PR All"` / `Manual UT Report No.`.
* `Temporary Lines`, `Exlude Full Cut & Debris`, `Exlude RT Films from UT`, `Bracing` —
  `DataSize` 1 064, то есть **на дату refresh ни одна строка не попала под условие**.
  Это не ошибка формулы, а состояние данных: у «PR all» `ISO Number` не заканчивается на
  `-PCC` (временные линии есть только в `Weld Dump`, где отдельная колонка
  `Temporary Lines "WD"`), и ни одна строка не удовлетворила тройному условию Full Cut+Debris+XX.
* `TMCP Pipe` (`DataSize` 1 504), `Stainless steel` (35 112), `Task_Status PIP-018-A "VPR"`
  (617 056), `By UT All` (8 184) — здесь cardinality 1 означает «одно **непустое** значение»
  (`"TMCP Pipe"`, `"Stainless Steel"`, `"Closed"`, `"BY UT"`) плюс BLANK. Это флаги, а не
  словари, и они работают.

---

## 4. Использование

### 4.1 Меры

Все 448 мер модели физически лежат на таблице `Calendar`. К «PR all» относятся **240**:

* **200** ссылаются на `'Project WD+WR+INCO+Acciona'` прямо в DAX;
* **171** несут `"PR all"` / `"PR All"` / `"PR ALL"` в имени;
* **131** — и то и другое; 40 мер названы `"PR all"`, но таблицу не упоминают, потому что
  они собраны из других мер (`DIVIDE([Numb RT/UT "PR all" "R"], [Numb RT/UT "PR all"])` и т. п.).

Семейства (полные тексты — `analysis/pbix/measures.md`, соответствие метрикам мокапа —
`analysis/calculation-logic.md` §2):

| семейство | сколько | ключевые меры |
|---|---:|---|
| сварка / объём | ~30 | `No Weld Done Project "PR all"`, `No Weld Done CCC/GAC/TEKFEN/MEDGULF/Inco`, `Joint Uniq "PR all" Welded`, `Joint Uniq "PR all" Total`, `Total Welded Dia WP1 "PR all"`, `Total Scope Dia "BW" "PR all"`, `Welding Dia Average Production per week` |
| контроль (RT/UT) | ~35 | `Numb RT/UT "PR all"` / `"A"` / `"R"` / `TESTED`, `Tested Joints "PR all"`, `Rejection Rate Joint "PR all"`, `RT Ratio % RT/ Welded Joint ID uniq "PR all"` |
| плёнки | ~20 | `RT Total Films "PR all"` / `"A"` / `"R"`, `RT Total Films by Joint …` (10 вариантов: `-"RS"`, `+"CCC RS"`, `Talisman`), `CUM RT FILM Ratio % "PR all"`, `RT FILM Rej Ratio % "PR all"` |
| RT-бэклог и прогноз | ~35 | `RT BACKLOG Total Project "PR all"`, `RT100%/RT20%/RT10%/RT5% Backlog Joints "PRall" (One Formula)`, `RT Backlog within 3 Days …` (5 бакетов старения), `RT … Forecast Backlog`, `Remaining Joints for 5/10/100% Control` |
| PWHT | 29 | `PWHT All BACKLOG All WELD TYPE "PR all"`, `… (New PBI Rule)`, `PWHT Backlog "CCC" …`, `PWHT Done All Weld Types "PR all"`, `PWHT Backlog within 3/7/15/30 Days` |
| UT / PAUT | ~30 | `Numb UT "PR All"` / `"A"` / `"R"` (+ `Tracker`-варианты), `UT Weld Length by Welder "PR all"`, `UT Defect Length by Joint "PR all"`, `Rejection UT Rate Length by Sub-Con "PR all"`, `% UT Unacceptable Limit 1.5% "PR all"` |
| FABRICATED / spool | 5 | `RT Backlog & FABRICATED "PR All"`, `RT Backlog & FABRICATED & PWHT Spool Date "PR All"`, `RT BACKLOG Total Project & PWHT"Y" NOT Done FABRICATED "PR all"` |
| старение / активность сварщиков | ~10 | `No Days Since Last Weld "PR all"`, `No of Welders Active 7 Days "PR all"`, `No of Welders NOT Active 7 to 21 / 21 to 90 / 90 to 180 / 180 Days "PR all"`, `Cur_Date "PR all"` |
| прочие NDE | ~15 | `MT Progress All "PR all"`, `PT/PMI/HT/ORIF/PADLT/VI/VBT Progress All "PR all"`, `MT + PT "PR all"` |
| кросс-сверка с FRB | 24 | `Total {RT,MT,PWHT,UT,PMI,PT,HT,ORIF,PADLT,VI,VBT} Reports Cross Check PRJ Data & FRB Match` / `Not Found` + 3 сводные |
| тест-пакеты | 5 | `TP Complete "PR all"`, `QTY TestPacks`, `Open Punch X/Y/Z` |
| Inco-специфика | 7 | `Inco RT/UT Length Overall / Last 2 weeks / Last 1 Month`, `Inco RT/UT Rej Length …`, `INCO Length Ratio %`, `RT BACKLOG INCO` |

### 4.2 Страницы и визуалы

**1 107 визуалов из 2 285 на 107 страницах из 144** имеют хотя бы одну привязку к таблице.
Типы: slicer 454, pivotTable 268, card 165, donutChart 68, columnChart 51,
stackedAreaChart 26, clusteredColumnChart 25, tableEx 21, lineChart 12, gauge 7,
lineClusteredColumnComboChart 6, lineStackedColumnComboChart 2, clusteredBarChart 1,
waterfallChart 1.

Самые используемые поля — число визуалов, в определении которых поле встречается **где угодно**
(проекция, фильтр визуала, сортировка): `Sub-Contractor` 549, `Weld Type` 364, `Weld Cat` 242,
`Joint ID` 144, `Welder ID` 140, `Weld Date` 114, `RT%` 113,
`RT FILM Ratio % STATUS LAST 2 WEEKS` 105, `Service class` 93, `RT Report` 89,
`Service Class + Service Cat+NDT Remarks` 89, `Service Cat` 87, `Welder` 73, `TMCP Pipe` 68,
`NDT Remarks` 54, `Days Since Last RT` 46, `HA` 24, `WPS No.` 26.
Если считать только поля, вынесенные в *проекции* визуала (роли Values/Category/Series),
порядок тот же, но числа втрое ниже: `Sub-Contractor` 184, `Weld Type` 146, `Weld Cat` 139,
`Joint ID` 107, `RT%` 100, `Welder ID` 96. В приложении A и в `prall-columns.json`
используется первый (широкий) счёт.

Все 107 страниц (`page displayName` → сколько визуалов привязано из скольких всего → типы →
топ-поля). Соответствие страницам мокапа — `analysis/calculation-logic.md` §1.2 и
`analysis/pbix/report-inventory.md` (раздел «Mapping»).

| page displayName | visuals bound / total | visual types | top fields |
|---|---|---|---|
| TESTPACK Internal. PROJECT RT% NDE AND PWHT STATUS   S.Class "PR all" | 35 / 41 | slicer×31, pivotTable×3, card×1 | `Sub-Contractor`, `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover \"PR all\"`, `Weld Cat`, `Welder ID`, `Joint ID` |
| Internal. PROJECT RT% NDE AND PWHT STATUS   S.Class "PR all" | 32 / 38 | slicer×29, pivotTable×2, card×1 | `Sub-Contractor`, `Weld Cat`, `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover \"PR all\"`, `Weld Type`, `Service Class + Service Cat+NDT Remarks` |
| Project Weld Progress "PR all" | 31 / 54 | slicer×20, pivotTable×5, gauge×5, lineStackedColumnComboChart×1 | `Weld Type`, `Sub-Contractor`, `Welder ID`, `RT Ratio % STATUS for Welder Cover 5% \"PR all\"`, `Joint ID` |
| CROSS CHECK PRJ Data & FRB | 31 / 32 | slicer×21, pivotTable×10 | `Joint ID`, `Sub-Contractor`, `MT CROSS CHECK PRJ Data & FRB`, `ORIF CROSS CHECK PRJ Data & FRB`, `ORIF Report` |
| Project NDE Status Report "PR all" | 30 / 36 | slicer×25, pivotTable×3, card×1, tableEx×1 | `Sub-Contractor`, `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover \"PR all\"`, `Service Class + Service Cat+NDT Remarks`, `Service class`, `Weld Cat` |
| Internal. PROJECT WELDER PERFOMANCE "PR all" | 26 / 28 | slicer×23, pivotTable×3 | `Sub-Contractor`, `Weld Type`, `RT Ratio % STATUS for Welder Cover 5% \"PR all\"`, `RT FILM Ratio % STATUS \"PR all\"`, `Service Class + Service Cat+NDT Remarks` |
| ERRORS 1  | 26 / 28 | slicer×15, pivotTable×10, tableEx×1 | `Sub-Contractor`, `RT%`, `Joint ID`, `Weld Type`, `Service Class + Service Cat+NDT Remarks` |
| RT/UT Films Progress Project | 25 / 57 | card×9, slicer×9, columnChart×5, donutChart×1 | `Weld Cat`, `Weld Type`, `RT Date`, `Week_End_Date from Calendar`, `YearRT` |
| RT Backlog Forecast | 25 / 40 | card×10, slicer×7, columnChart×5, clusteredBarChart×1 | `Weld Cat`, `Weld Type`, `RT Date`, `Sub-Contractor`, `YearRT` |
| Rep. Welding- INCO "PR all" | 25 / 32 | card×19, tableEx×2, lineChart×2, clusteredColumnChart×1 | `Sub-Contractor`, `Weld Type`, `Repair Length (mm)`, `RT Report`, `Weld Date` |
| Internal. UT PROJECT WELDER PERFOMANCE "PR all" | 24 / 32 | slicer×23, pivotTable×1 | `Sub-Contractor`, `UT Rej Rate % STATUS for Welder by Length Last 2 Weeks`, `Weld Type`, `UT Rej Rate % STATUS for Sub-Con by Joint`, `UT Operator ID.` |
| RT/UT Progress Project | 23 / 55 | slicer×9, card×9, columnChart×4, donutChart×1 | `Weld Cat`, `Weld Type`, `Sub-Contractor`, `RT Date`, `HT Remarks` |
| REP. Project Welding Progress +Inco+Acciona | 23 / 44 | card×17, lineChart×2, clusteredColumnChart×1, donutChart×1 | `Sub-Contractor`, `Weld Type`, `Weld Cat`, `Repair & Reweld \"PR all\"` |
| Internal. For Lead NDE RT 5% & RT 10% Backlog Summary Status | 23 / 27 | slicer×13, pivotTable×5, card×5 | `RT%`, `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover \"PR all\" STATUS`, `Service class`, `Sub-Contractor`, `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover \"PR all\"` |
| RT/UT Progress Project Dia Inch | 22 / 55 | card×10, slicer×7, columnChart×4, donutChart×1 | `Weld Cat`, `Weld Type`, `Sub-Contractor`, `RT Date`, `Week_End_Date from Calendar` |
| WPS for Managment | 22 / 27 | slicer×14, card×6, pivotTable×2 | `Sub-Contractor`, `Weld Type`, `Weld Cat`, `Welder ID`, `Material Type` |
| Material for Managment | 22 / 27 | slicer×14, card×6, pivotTable×2 | `Sub-Contractor`, `Weld Type`, `Welder ID`, `Material Type`, `Service Class + Service Cat+NDT Remarks` |
| Rep. Welding- CCC "PR all" | 21 / 27 | pivotTable×7, card×5, clusteredColumnChart×4, lineClusteredColumnComboChart×2 | `Sub-Contractor`, `Weld Cat`, `Weld Type`, `Service Cat`, `TMCP Pipe` |
| WPS / Material for Managment | 20 / 25 | slicer×12, card×6, pivotTable×2 | `Sub-Contractor`, `RT Ratio % STATUS for Welder Cover 5% \"PR all\"`, `Material Type`, `Welder ID`, `Weld Cat` |
| Internal. Service Class+Cat Performance "PR all"  | 19 / 23 | slicer×10, pivotTable×8, card×1 | `Sub-Contractor`, `Service Class + Service Cat+NDT Remarks`, `RT%`, `Service class`, `Weld Type` |
| Inter. SS Welding-Medgulf | 18 / 36 | pivotTable×6, card×5, slicer×4, clusteredColumnChart×2 | `Sub-Contractor`, `Weld Type`, `Weld Cat`, `TMCP Pipe`, `Service Cat` |
| Rep. Project Welders Performance.  Cumulative Rejection Rate. Summary Report. "PR "All" | 18 / 24 | stackedAreaChart×8, pivotTable×5, donutChart×4, slicer×1 | `RT FILM Ratio % STATUS LAST 2 WEEKS`, `Days Since Last RT`, `Welder ID`, `Sub-Contractor`, `RT FILM Ratio % STATUS \"PR all\"` |
| Rep. Welding-Tekfen  | 17 / 36 | card×7, pivotTable×4, clusteredColumnChart×3, donutChart×2 | `Sub-Contractor`, `TMCP Pipe`, `Weld Cat`, `Weld Type`, `Service Cat` |
| Err 8 PWHT CCC Y/N Tr/Fl | 17 / 17 | slicer×15, tableEx×1, card×1 | `Joint ID`, `Weld Type`, `WPS From \"Talisman\"`, `HA`, `PWHT Y/N CCC` |
| Rep. Welding- Acciona "PR all" | 16 / 21 | card×11, lineChart×2, columnChart×1, lineClusteredColumnComboChart×1 | `Sub-Contractor`, `Repair & Reweld \"PR all\"`, `Custom14`, `Welder`, `WPS No.` |
| Rep.  Project Welder Status "PR all" | 16 / 34 | donutChart×13, columnChart×2, pivotTable×1 | `Sub-Contractor`, `Welder ID`, `Weld Type`, `Weld Cat` |
| Internal CPY Rep. FlangeManagment | 15 / 90 | pivotTable×7, slicer×6, donutChart×2 | `Weld Type`, `Weld Cat` |
| Err 10 PIC & Talisman | 15 / 28 | pivotTable×6, card×4, slicer×3, gauge×2 | `Sub-Contractor`, `Area Classification`, `RT%`, `Weld Type`, `Weld Date` |
| Inter.Welding- GAC- SLG | 14 / 16 | pivotTable×5, slicer×4, card×3, donutChart×1 | `Sub-Contractor`, `Weld Type`, `Service Cat`, `Weld Cat`, `Service Class + Service Cat+NDT Remarks` |
| WEEKLY WELDER PERFORMANCE LAST 2 Weeks "PR all" | 14 / 17 | slicer×12, pivotTable×2 | `Weld Type`, `Joint ID`, `Welder ID`, `Sub-Contractor`, `UT Rej Rate % STATUS for Sub-Con by Joint` |
| Rep. Project Welders Performance. Cumulative Rejection Rate. Summary Report. 1 Month "PR "All" | 14 / 20 | pivotTable×5, donutChart×4, stackedAreaChart×4, slicer×1 | `RT FILM Ratio % STATUS LAST 2 WEEKS`, `Days Since Last RT`, `Welder ID`, `Sub-Contractor`, `RT FILM Ratio % STATUS LAST 1 Month` |
| UT Rep. Project Welders Performance.  Cumulative Rejection Rate. Summary Report.  | 14 / 20 | pivotTable×5, donutChart×4, stackedAreaChart×4, slicer×1 | `RT FILM Ratio % STATUS LAST 2 WEEKS`, `UT Rej Rate % STATUS for Welder by Length Last 2 Weeks`, `Welder ID`, `Sub-Contractor`, `Days Since Last UT` |
|  Err 9 WPS PIC & Tal.n  Tr/Fl | 14 / 14 | slicer×12, tableEx×1, card×1 | `Joint ID`, `PWHT Report No CCC`, `WPS From \"Talisman\"`, `RT Report`, `Service class` |
| Rep. Welding- GAC  | 12 / 30 | pivotTable×4, card×3, lineChart×2, clusteredColumnChart×2 | `Service Cat`, `Sub-Contractor`, `Weld Cat`, `Weld Type`, `TMCP Pipe` |
| Rep. Welding- GAC- SLG | 12 / 31 | pivotTable×4, card×3, clusteredColumnChart×2, lineChart×1 | `Service Cat`, `Sub-Contractor`, `Weld Cat`, `Weld Type`, `TMCP Pipe` |
| Rep.  Project Welder Summary "PR all" | 12 / 13 | columnChart×12 | `Sub-Contractor` |
| Rep. Acciona Project Welders Performance. Cumulative Rejection Rate. Summary Report. "PR "All" | 11 / 15 | pivotTable×5, donutChart×3, stackedAreaChart×3 | `RT FILM Ratio % STATUS LAST 2 WEEKS`, `Days Since Last RT`, `Welder ID`, `Sub-Contractor`, `RT FILM Ratio % STATUS \"PR all\"` |
| Month WELDER PERFORMANCE LAST Month "PR all" | 11 / 14 | slicer×9, pivotTable×2 | `Weld Type`, `Welder ID`, `Sub-Contractor`, `Joint ID`, `UT Rej Rate % STATUS for Welder by Length Last 2 Weeks` |
| Err 2 CCC | 11 / 12 | slicer×8, pivotTable×3 | `Joint ID`, `RT Report`, `Sub-Contractor`, `Weld Date`, `RT Acc/Rej` |
| Rep. Welding Progress Tekfen & (TMPC) | 10 / 22 | pivotTable×10 | `Weld Cat`, `Weld Type`, `Sub-Contractor`, `Service Cat`, `TMCP Pipe` |
| Rep. Welding  (TMCP) - Tekfen  | 10 / 29 | pivotTable×4, card×3, clusteredColumnChart×2, donutChart×1 | `TMCP Pipe`, `Sub-Contractor`, `Weld Cat`, `Weld Type`, `Service Cat` |
| Rep. Welding-Medgulf | 10 / 28 | pivotTable×4, card×3, clusteredColumnChart×2, donutChart×1 | `Sub-Contractor`, `TMCP Pipe`, `Weld Cat`, `Weld Type`, `Service Cat` |
| CPY Rep. FlangeManagment | 10 / 87 | pivotTable×6, donutChart×2, slicer×1, card×1 | `Weld Type`, `Weld Cat` |
| Internal.Project PWHT by RT% STATUS   "PR all" | 10 / 12 | slicer×7, pivotTable×3 | `Weld Cat`, `Weld Type`, `RT%`, `Sub-Contractor`, `Service Class + Service Cat+NDT Remarks` |
| Internal.Rejection Welder Performance "PR all" | 10 / 11 | pivotTable×4, slicer×4, lineStackedColumnComboChart×1, waterfallChart×1 | `RT Acc/Rej`, `Joint ID`, `Sub-Contractor`, `Welder ID`, `Defect Code` |
| Err 11 CCC Cross Check PIC & TALisman | 10 / 11 | slicer×7, pivotTable×2, tableEx×1 | `Weld Type`, `Sub-Contractor`, `Service Class + Service Cat+NDT Remarks`, `Service class`, `Weld Cat` |
| Internal Rep. FlangeManagment By Dia | 9 / 44 | pivotTable×4, card×2, slicer×2, donutChart×1 | `Weld Type`, `Weld Cat` |
| Rep. Project Welders Performance. Cumulative Rejection Rate. Summary Report. 1 Month "PR "All" 2 | 9 / 13 | pivotTable×4, donutChart×3, stackedAreaChart×2 | `RT FILM Ratio % STATUS LAST 2 WEEKS`, `Days Since Last RT`, `Welder ID`, `Sub-Contractor`, `RT FILM Ratio % STATUS \"PR all\"` |
| Internal  GAC Welders Performance.  Cumulative Rejection Rate. Summary Report. "PR "All" | 9 / 12 | pivotTable×6, stackedAreaChart×1, slicer×1, donutChart×1 | `RT FILM Ratio % STATUS LAST 2 WEEKS`, `Welder ID`, `Welder`, `Sub-Contractor`, `RT Ratio % STATUS for Welder Cover 5% \"PR all\"` |
| Internal  TEKFEN Welders Performance.  Cumulative Rejection Rate. Summary Report. "PR "All" | 9 / 12 | pivotTable×6, slicer×1, stackedAreaChart×1, donutChart×1 | `RT FILM Ratio % STATUS LAST 2 WEEKS`, `Welder ID`, `Welder`, `Sub-Contractor`, `RT Ratio % STATUS for Welder Cover 5% \"PR all\"` |
| Internal  MEDGULF Welders Performance.  Cumulative Rejection Rate. Summary Report. "PR "All" | 9 / 12 | pivotTable×6, donutChart×1, slicer×1, stackedAreaChart×1 | `RT FILM Ratio % STATUS LAST 2 WEEKS`, `Welder ID`, `Welder`, `Sub-Contractor`, `RT Ratio % STATUS for Welder Cover 5% \"PR all\"` |
| Talisman Line Class | 9 / 10 | slicer×9 | `Sub-Contractor` |
| NDE Man Power | 8 / 8 | slicer×4, columnChart×3, pivotTable×1 | `Weld Cat`, `Sub-Contractor`, `Weld Type` |
| Rep. Welding Progress GAC  | 8 / 18 | pivotTable×8 | `Service Cat`, `Weld Cat`, `Weld Type`, `Sub-Contractor`, `Joint ID` |
| Internal CCC Welders Performance.  Cumulative Rejection Rate. Summary Report. "PR "All" | 8 / 11 | pivotTable×5, stackedAreaChart×1, slicer×1, donutChart×1 | `Welder ID`, `RT FILM Ratio % STATUS LAST 2 WEEKS`, `Sub-Contractor`, `RT Ratio % STATUS for Welder Cover 5% \"PR all\"`, `RT FILM Ratio % STATUS \"PR all\"` |
| Internal. Days Between Fit-Up & Today Duplicate "PR all" | 8 / 11 | slicer×4, pivotTable×2, donutChart×2 | `Joint ID`, `No Of Days Fit-UP - Today STATUS \"PR all\"`, `Sub-Contractor`, `No Of Days Weld Date - Today RT STATUS \"PR all\"`, `No of Days Weld Date - TODAY \"PR all\"` |
| CCC RT | 8 / 10 | slicer×7, pivotTable×1 | `Joint ID`, `RT Date`, `Welder ID`, `RT Report`, `RT Acc/Rej` |
| R/RS for Bala | 8 / 8 | slicer×3, card×3, columnChart×2 | `RT Acc/Rej`, `Joint ID`, `RT Re-Shoot Data`, `Sub-Contractor`, `RT Date` |
| RT Films WD+WR from data | 8 / 9 | slicer×4, card×2, pivotTable×2 | `Sub-Contractor`, `RT Re-Shoot Rep`, `RT Acc/Rej`, `RT Report`, `Weld Type` |
| QTY Welders & No RT Report | 7 / 7 | slicer×5, tableEx×2 | `Sub-Contractor`, `Welder ID`, `Service Class + Service Cat+NDT Remarks`, `Weld Date`, `RT Report` |
| CPY Rep. FlangeManagment Page 2 | 6 / 41 | pivotTable×3, donutChart×2, slicer×1 | `Weld Type`, `Weld Cat` |
| Internal Rep. FlangeManagment | 6 / 41 | card×2, pivotTable×2, slicer×1, donutChart×1 | `Weld Type`, `Weld Cat` |
| Internal Rep. FlangeManagment TP wise | 6 / 41 | card×2, pivotTable×2, donutChart×1, slicer×1 | `Weld Type`, `Weld Cat` |
| Internal.Project RT % NDE STATUS   S.Class "PR all" | 6 / 8 | slicer×4, pivotTable×2 | `Weld Type`, `Sub-Contractor`, `RT%`, `Service Class + Service Cat+NDT Remarks`, `Service class` |
| FW / Bracing | 6 / 7 | slicer×5, pivotTable×1 | `Joint ID`, `Bracing`, `Weld Type`, `Sub-Contractor`, `Weld Date` |
| Page 1 | 6 / 6 | slicer×5, pivotTable×1 | `WeldPoint No.`, `RT Acc/Rej`, `RT Report`, `Total No of films Rej`, `Sub-Contractor` |
| REP. Project Welding & NDE Status +INCO+Acciona | 5 / 10 | pivotTable×5 | `Weld Cat`, `Weld Type`, `Sub-Contractor`, `Joint ID`, `TMCP Pipe` |
| MPI Done | 5 / 8 | clusteredColumnChart×3, card×2 | `Sub-Contractor` |
| Summary  of CROSS CHECK PRJ Data & FRB | 5 / 15 | pivotTable×4, slicer×1 | `Sub-Contractor`, `MT Report \"PR All\"`, `VBT Report`, `PWHT Report \"PR All\"`, `DWIR Report \"PR All\"` |
| REP. CCC WELDING STATUS "PR all" | 4 / 5 | pivotTable×4 | `Weld Type`, `Weld Cat`, `Sub-Contractor` |
| Rep. Welding Progress  MEDGULF  | 4 / 9 | pivotTable×4 | `Service Cat`, `Weld Cat`, `Weld Type`, `Sub-Contractor`, `TMCP Pipe` |
| Rep. CCC RT 100% NDE STATUS   S.Class "PR all" | 4 / 5 | pivotTable×3, slicer×1 | `RT%`, `Weld Cat`, `Weld Type`, `Joint ID`, `Sub-Contractor` |
| Rep.  CCC Welder Status "PR all" | 4 / 6 | columnChart×2, donutChart×1, pivotTable×1 | `Sub-Contractor`, `Weld Type`, `Welder ID`, `Weld Date`, `Welder` |
| Rep.  GAC Welder Status "PR all" | 4 / 6 | columnChart×2, donutChart×1, pivotTable×1 | `Sub-Contractor`, `Weld Type`, `Welder ID`, `Weld Date`, `Welder` |
| Rep.  TEKFEN Welder Status "PR all" | 4 / 6 | columnChart×2, pivotTable×1, donutChart×1 | `Sub-Contractor`, `Weld Type`, `Welder ID`, `Weld Date`, `Welder` |
| Rep. MEDGULF Welder Status "PR all" | 4 / 6 | columnChart×2, pivotTable×1, donutChart×1 | `Sub-Contractor`, `Weld Type`, `Welder ID`, `Weld Date`, `Welder` |
| Rep. Inco  Welder Status "PR all" | 4 / 6 | columnChart×2, donutChart×1, pivotTable×1 | `Sub-Contractor`, `Weld Type`, `Welder ID`, `Weld Date`, `Welder` |
| Rep.  Acciona Welder Status "PR all" | 4 / 6 | columnChart×2, donutChart×1, pivotTable×1 | `Sub-Contractor`, `Weld Type`, `Welder ID`, `Weld Date`, `Welder` |
| Err 12 CCC Thickness | 4 / 4 | slicer×3, tableEx×1 | `Thickness from \"JR\" True/False Status`, `Joint ID`, `Sub-Contractor`, `Duplicate RT Date`, `Weld Type` |
| Talisman | 4 / 5 | slicer×4 | `Sub-Contractor` |
| Rep. CCC-PWHT by RT 100 % STATUS   "PR all" | 3 / 4 | pivotTable×2, slicer×1 | `RT%`, `Weld Cat`, `Weld Type`, `PWHT Y/N CCC`, `Service Class + Service Cat+NDT Remarks` |
| Rep. CCC RT 5% NDE STATUS   S.Class "PR all" | 3 / 4 | pivotTable×2, slicer×1 | `RT%`, `Service Class + Service Cat+NDT Remarks`, `Weld Date`, `Sub-Contractor`, `Weld Cat` |
| Rep. CCC-PWHT by RT 5% STATUS   "PR all" | 3 / 4 | pivotTable×2, slicer×1 | `RT%`, `Weld Cat`, `Weld Type`, `PWHT Y/N CCC`, `Service Class + Service Cat+NDT Remarks` |
| Rep. CCC RT 10% NDE STATUS   S.Class "PR all" | 3 / 4 | pivotTable×2, slicer×1 | `RT%`, `Service Class + Service Cat+NDT Remarks`, `Weld Date`, `Weld Cat`, `Weld Type` |
| Rep. CCC-PWHT by RT 10% STATUS   "PR all" | 3 / 4 | pivotTable×2, slicer×1 | `RT%`, `Weld Cat`, `Weld Type`, `PWHT Y/N CCC`, `Service Class + Service Cat+NDT Remarks` |
| Rep. CCC RT 20% NDE STATUS   S.Class "PR all" | 3 / 4 | pivotTable×2, slicer×1 | `Service Class + Service Cat+NDT Remarks`, `Weld Date`, `Weld Cat`, `RT%`, `Sub-Contractor` |
| Err 11 CCC Cross Check TALisman & PIC | 3 / 12 | pivotTable×2, tableEx×1 | `Weld Type`, `Weld Cat`, `Joint ID`, `CROSS CHECK DATA & Talisman JOINT ID`, `RT%` |
| Rep. BW & RT Progress - INCO "PR all" | 2 / 2 | tableEx×2 | `Repair Suffix`, `Weld Type`, `Weld Length`, `Repair Length (mm)`, `Weld Date` |
| Rep. GAC Weld Rejection Detail as per WPS | 2 / 4 | pivotTable×2 | `Service Cat`, `Weld Type`, `Sub-Contractor`, `Weld Date`, `WPS No.` |
| Rep. TEKFEN  Weld Rejection Detail as per WPS | 2 / 4 | pivotTable×2 | `Service Cat`, `Weld Type`, `TMCP Pipe`, `Sub-Contractor`, `Weld Date` |
| Rep. Acciona Inco Weld Rej. Detail as per WPS "PR All" | 2 / 2 | tableEx×1, pivotTable×1 | `Weld Type`, `Sub-Contractor`, `Weld Date`, `WPS No.`, `Repair Suffix` |
| Total Welders Qualification Status Summary Report  | 2 / 14 | donutChart×1, stackedAreaChart×1 | `RT FILM Ratio % STATUS LAST 2 WEEKS`, `RT FILM Ratio % STATUS \"PR all\"`, `Welder ID` |
| Err 7 RT/UT CCC | 2 / 2 | tableEx×1, slicer×1 | `Sub-Contractor`, `Joint ID`, `By UT`, `Manual UT Status.`, `RT/UT` |
| WP 2024 - 2025 | 2 / 2 | lineClusteredColumnComboChart×2 | `Weld Cat`, `Sub-Contractor` |
| RT Films WD+WR Pivot | 2 / 5 | pivotTable×1, slicer×1 | `Sub-Contractor`, `Joint ID`, `HA`, `RT Acc/Rej`, `RT Report` |
| Rep. GAC NDE RT 20% STATUS  | 1 / 6 | pivotTable×1 | `Joint ID`, `Weld Cat`, `Weld Type`, `RT%`, `Sub-Contractor` |
| Rep. CCC Weld Rej. Detail as per WPS "PR All" | 1 / 1 | pivotTable×1 | `WPS No.`, `Weld Type`, `Sub-Contractor` |
| Rep. MEDGULF Weld Rejection Detail as per WPS | 1 / 2 | pivotTable×1 | `Service Cat`, `Weld Type`, `TMCP Pipe`, `Sub-Contractor`, `Weld Date` |
| SCTR OVERALL APPLIED WELDERS / WPQ RECORD REGISTER | 1 / 7 | clusteredColumnChart×1 | `Sub-Contractor` |
| Spool Status | 1 / 7 | pivotTable×1 | `Joint ID`, `RT%`, `Weld Type`, `RT FILM Ratio % STATUS LAST 2 WEEKS`, `Welder ID` |
| Err 3 CCC | 1 / 10 | tableEx×1 | `Duplicate Weld Date`, `Weld Date`, `Sub-Contractor`, `Joint ID` |
| Err 4 CCC | 1 / 14 | tableEx×1 | `Duplicate Weld Date`, `Weld Date`, `Sub-Contractor`, `Joint ID` |
| Err 5 CCC | 1 / 13 | tableEx×1 | `Duplicate Weld Date`, `Weld Date`, `Sub-Contractor`, `Joint ID` |
| Err 6 CCC | 1 / 9 | tableEx×1 | `Duplicate Weld Date`, `Weld Date`, `Sub-Contractor`, `Joint ID` |
| WPS Reg# | 1 / 5 | tableEx×1 | `Duplicate RT Date`, `UT Acc/Rej`, `Weld Date`, `Manual UT Status`, `Rej Length` |
| CROSS CHECK FRB Data  & PRJ | 1 / 7 | pivotTable×1 | `Joint ID` |
| Master Register & WD+WR | 1 / 9 | card×1 | `Weld Type`, `Sub-Contractor` |

### 4.3 Связи

Из 14 связей модели таблица участвует в трёх:

| from | to | карди­нальность | cross-filter | активна | что даёт |
|---|---|---|---|---|---|
| `Project WD+WR+INCO+Acciona[Joint ID]` | `l2_ndt_list[Joint_ID]` | **M:M** | Both | да | реестр отчётов NDE (202 строки). Через него работают 24 меры `Total … Cross Check PRJ Data & FRB Match/Not Found` и 11 вычисляемых колонок `* CROSS CHECK PRJ Data & FRB`. Заметьте: сами колонки не пользуются связью — они делают `FILTER('l2_ndt_list', … [Origin_Report_No] = …)`, то есть join по **номеру отчёта**, а связь построена по `Joint ID`. Связь нужна мерам, колонкам — нет. |
| `TALISMAN DATA[Index]` | `Project WD+WR+INCO+Acciona[Index]` | 1:1 | Both | **да** | сцепка 3 098 341 строки Talisman с нашими 6 546 261 **по порядковому номеру строки**. `FromKeyCount` 3 098 344 vs `ToKeyCount` 6 546 264 — 1:1 при разном числе ключей означает, что совпадает только первые ~3,1 млн строк. Это не бизнес-ключ; воспроизводить его нельзя и не нужно — колонка `CROSS CHECK DATA & Talisman JOINT ID` делает нормальный `LOOKUPVALUE` по `Joint ID`. |
| `Flange Progress[Index]` | `Project WD+WR+INCO+Acciona[Index]` | 1:1 | Both | **нет** | то же самое для фланцевого дашборда, отключено. |

Практический вывод: **из трёх связей воспроизводить надо только первую**, и то как обычный
join `weld.joint_id = ndt_report.joint_id`. Две «`Index`»-связи — артефакт Power Query.

---

## 5. Сопоставление с нашей схемой `weld`

База: `db/migrations/0003_weld.sql` (194 типизированных колонки дампа + производные),
имена — `analysis/dump/profile.md` §8.1 дословно. `weld_source` — enum
`('WELD_DUMP','CCC_WELDER_RECORD','ACCIONA','INCO')`.

Механическое сопоставление (snake_case имени pbix → колонка `weld`) даёт **213 совпадений
из 425**: 203 импортированных и 10 вычисляемых. Полная карта — поле `ourColumn` в
`analysis/pbix/raw/prall-columns.json`.

### 5.1 Что уже есть и работает

| pbix | `weld` | статус |
|---|---|---|
| `Joint ID` | `joint_id` (NOT NULL, индекс) | ✅ производится загрузчиком по формуле M |
| `Spool ID` | `spool_id` | ✅ |
| `RT Film Total` | `rt_film_total` | ✅ `GENERATED ALWAYS AS (coalesce(acc,0)+coalesce(rej,0))` |
| `Repair & Reweld "PR all"` | `repair_reweld` | ✅ материализована; **но** правило «PR all» отличается от «WD» — см. §5.3 |
| `Service Class + Service Cat+NDT Remarks` | `service_class_cat_ndt` | ✅ |
| `Service Class+Service Cat "WD"` (это колонка `Weld Dump`) | `service_class_cat_wd` | ✅ отдельная — не смешивать |
| `TMCP Pipe` | `tmcp_pipe` boolean | ⚠️ реализовано по правилу «WD» (`dia_inch = 46`); в «PR all» это `IN (30,34,46)` |
| `Temporary Lines` | `temporary_lines` boolean | ✅ (в «PR all» на дату refresh пусто) |
| `Exlude RT Films from UT` | `exclude_ut_films` | ✅ |
| `Exlude Full Cut & Debris` | `exclude_debris_films` | ✅ |
| `PWHT Y/N CCC` / `PWHT Report No CCC` / `PWHT Date No CCC` | `pwht_y_n_ccc`, `pwht_report_no_ccc`, `pwht_date_no_ccc` | 🟡 колонки есть, **загрузчик их не наполняет** — источник `AllTrain_CSVExport_Joint Record.csv` появился в `sources/` только сейчас |
| `HA` | `ha` | 🟡 колонка есть, пустая |
| весь блок методов PWHT/HT/RT/UT/MT/PMI/PT + `Weld Length`, `Rej Length`, `Defect Code` | одноимённые snake_case | ✅ |

### 5.2 Плейсхолдеры, которые перестают быть плейсхолдерами

Эти шесть колонок `weld` заведены как «M placeholder, '' for WELD_DUMP rows». Для строк
CCC/Acciona/Inco они **несут данные**, и без них половина «PR all» не считается:

| колонка | кто наполняет | зачем |
|---|---|---|
| `repair_suffix` | `CSVExport_Welder Record.csv` (`Repair Suffix`, R01→R1/R02→R2) | входит в `joint_id` CCC и в `repair_reweld` |
| `original_joint` | там же (`Original Joint`; в текущем файле — `#` в 5 389 971 строке) | связь ремонта с исходным стыком |
| `weld_point_code` | там же (`Weld Point Code`, 5 значений) | M23 «плёнки по стыку» |
| `rt_ut` | там же (`RT/UT`, 3 значения) | разделение RT и UT в одном столбце отчёта — база `Report TYPE`, `By UT All`, `UT Report "PR All"` |
| `ndt_remarks` | там же + Acciona (5 значений) | четвёртая часть ключа `service_class_cat_ndt` |
| `tracer_shot` | там же (`Tracer Shot`, 9 значений) | `RT Weld Status = "T"` для CCC |

Плюс `spool_status` (нужен `Spool Dump.txt` — **теперь есть в `sources/`**).

### 5.3 Что должен добавить загрузчик (материализовать при загрузке)

Порядок — по стоимости отсутствия.

1. **`weldpoint_seq`** (= `WeldPoint No.1 WP1`).
   `ROW_NUMBER() OVER (PARTITION BY joint_id ORDER BY id)`. От неё зависят 14 мер
   `Total … Dia WP1 …` — весь «объём сварки в дюймах». В SQL это оконная функция, но её
   нельзя считать на лету в каждой метрике: понадобится как материализованная колонка либо
   как индексированный CTE.
2. **`welder_id`** = `welder || '-' || sub_contractor`. Тривиально, но 96 визуалов и 19 мер
   группируются именно по ней, а не по `welder`: табельные номера пересекаются между
   субподрядчиками (3 940 против 3 896).
3. **`repair_reweld` — вторая редакция для «PR all».** Текущая реализация — правило `Weld Dump`
   (по `weld_no`). «PR all» считает по `joint_id` **и** добавляет: `sub_contractor = 'Inco'`
   → пусто; `repair_suffix = 'RW1'` → `'Reweld'`; `repair_suffix = 'RS1'` → `'RS1'`.
   Нужна либо вторая колонка, либо `CASE` по `source`.
4. **`tmcp_pipe` — расширить** до `service_class='9C3AQN' AND dia_inch IN (30,34,46)`
   для не-`WELD_DUMP` строк (сейчас только 46).
5. **`testpack_no_all`** (= `TESTPACK No "PR All"`). Для CCC — `Test Package No` из
   `AllTrain_CSVExport_Joint Record.csv` по `Joint ID`, иначе `max(testpack_no)` по
   `joint_id`. Cardinality растёт с 17 875 до 29 456 — без этого страница TESTPACK
   недосчитывает 40 % пакетов.
6. **`ha`** — заполнить: 2-я цифра `subsystem_code`, иначе 2-я цифра `system_no`, иначе
   lookup по справочнику `HA l0_abs_guide` (912 строк; **этого файла в `sources/` нет**).
   24 визуала на 15 страницах используют `HA`; фланцевый дашборд — тоже.
7. **CCC-ветки NDE из Joint Record** (`pwht_y_n_ccc`, `pwht_report_no_ccc`, `pwht_date_no_ccc`,
   `mt_report_ccc`, `mt_date_ccc`, `mt_pct_ccc`, `pmi_*_ccc`, `pt_*_ccc`, `ht_*_ccc`,
   `dwir_ccc_from_jr`, `thickness_from_jr`, `rework_code_all`) — 12+ колонок,
   все считаются одним `LEFT JOIN` к joint-record по `joint_id`, `MAX(...)` по группе.
   Файл теперь есть (`sources/AllTrain_CSVExport_Joint Record.csv`, 1 612 440 строк).
8. **UT-оверлеи** `manual_ut_report_no_all`, `manual_ut_status_all`, `manual_ut_date_all`,
   `ut_operator_id_all`, `ut_report_all`, `ut_date_all`.
   ⚠️ **Коллизия имён.** В pbix есть и импортированная `Manual UT Report No`, и вычисляемая
   `Manual UT Report No.` (с точкой) — это **разные** колонки, и вторая перекрывает первую
   значениями из UT-трекеров. То же для `Manual UT Date`/`Manual UT Date.`,
   `Manual UT Status`/`Manual UT Status.`, `UT Operator ID`/`UT Operator ID.`.
   В `weld` сейчас по одной колонке на пару — нужны отдельные `*_all`.
   В `prall-columns.json` эти четыре пары помечены `ourColumnCollision: true`.
   Трекер CCC уже в `sources/`; **`UT TRACKER (GAC)_Master.xlsx` и `UT TRACKER (TEK).xlsx` — нет**
   (ruling R-05 остаётся открытым).
9. **`weld_length_m`** (= `Weld Length "PR all"`): Inco → `weld_length / 1000`,
   иначе lookup по справочнику `Weld Length[Dia inch]`. Файл
   `sources/Weld Length/Weld Length.xlsx` **теперь есть**. Без него UT-метрики по длине
   (M33–M36) у CCC не считаются.
10. **`inspected_length_mm` / `defect_length_mm`** — производные от п. 8 и 9,
    материализовать вместе с ними (в DAX это отдельные колонки, потому что от них зависят
    шесть процентов брака UT).
11. **`week_end_date_rt`** — конец недели `rt_date` из календаря; тривиальный
    `date_trunc('week', rt_date) + 6`.

### 5.4 Что оставлять SQL-выражениями в `lib/metrics` (не материализовать)

Все «светофоры» и все `ALLEXCEPT`-отношения — это **агрегаты, записанные как колонки**,
классический антипаттерн Power BI. В SQL им место в `GROUP BY`-запросе метрики, а не в таблице:

* 8 колонок `RT Film Ratio % …` / `RT Ratio % …` и их 8 `STATUS`-двойников;
* 12 колонок `UT Rej Rate % …` + `Inco … Ratio %` и их `STATUS`-двойники;
* `TP Ratio % Complete "PR all"`, `TP Complete %`, `TP Ratio % STATUS`;
* `BATCH QTY Joints`, `Duplicate RT Date/Report/Weld Date`, `Duplicate RT Report by Joint`;
* `Days Since Last Weld/RT/UT/First Weld`, `No of Days …` — это `:as_of − дата`, параметр запроса;
* `2 weeks Period for RT` — 37 захардкоженных окон; в SQL это `generate_series` от 2023-07-28
  с шагом 14 дней;
* 11 колонок `* CROSS CHECK PRJ Data & FRB` — это `EXISTS` к таблице реестра NDE;
* `Open_Punch_"X"/"Y"/"Z"`, `Reinstatement_Date` — join к `Testpack-wise Details Report`
  (файла нет в `sources/`);
* `Status WPQ Welding Process`, `Status WPQ Type of Welding Machine`, `Bracing`,
  `Stainless steel`, `Dia Inch >20<`, `Weld CAT (NEW)`, `Train SG`, `LINE`, `Report TYPE`,
  `By UT All` — чистые выражения от одной строки.

Портировать **не надо вовсе** 17 мёртвых колонок из §2.3, три `Status … from "WD"` — тем более.

### 5.5 Открытые решения для оркестратора

> Параллельная линия уже выпустила `analysis/sources2/rulings.md` (R2-01…R2-16) — они
> обязательны и здесь не переспрашиваются. Ниже — то, что ими **не** покрыто, плюс два
> уточнения к ним.
>
> **Уточнение к R2-12 (`repair_reweld` для CCC).** Точное правило из
> `Project WD+WR+INCO+Acciona[Repair & Reweld "PR all"]` (verbatim в §2.2.1):
> `Sub-Contractor = "Inco"` → BLANK; иначе `RIGHT(Joint ID,2)` = `R1` или `R2` → `"Repair"`,
> = `RW` → `"Reweld"`; иначе `Repair Suffix = "RW1"` → `"Reweld"`, `= "RS1"` → **`"RS1"`**
> (третья категория, **не** `"Repair"`); иначе `""`. Набросок в R2-12
> («`RS*`/`R0*` → Repair») этому не соответствует. Cardinality колонки в модели = 4,
> что и даёт ровно Repair / Reweld / RS1 / пусто.
>
> **Уточнение к R2-10.** Здесь я цитирую 22 переименования по
> `calculation-logic.md` §1.3; батч-2 насчитал 25 (плюс три reshoot-переименования).
> Пересчёт не делал — верить надо более позднему источнику.

1. **Пятый источник.** Включаем ли `AllTrain_CSVExport_Joint Record NOT WELDED`
   (130 994 несваренных стыка CCC, `Del Flag = "" AND Weld Date IS NULL`) в `weld`?
   Без него меры «Total Scope»/«Balance»/«Forecast Backlog» для CCC занижены; с ним
   в `weld` появляются строки без `weld_date`, и каждый существующий запрос надо
   перепроверить на `weld_date IS NOT NULL`.
   *Рекомендация: включить как отдельное значение enum, а не подмешивать в
   `CCC_WELDER_RECORD`* — иначе провенанс врёт и ломается пер-сорсный счёт строк.
   **Уже реализуется параллельной линией:** `db/migrations/0009_weld_source_ccc_joint_record.sql`
   добавляет `weld_source` значение `CCC_JOINT_RECORD` (ruling R2-03). Пункт можно считать
   закрытым — остаётся проверить, что каждый существующий запрос метрик несёт
   `weld_date IS NOT NULL` там, где считает сваренное.
2. **Ключ связи.** Воспроизводим ли мы связи по `Index`? *Рекомендация: нет* — заменить
   join'ом по `joint_id` (§4.3). Нужно подтверждение, что никакая метрика на них не завязана.
3. **Пара `Manual UT * / Manual UT *.`** — добавляем шесть колонок `*_all` (§5.3 п. 8)
   или переопределяем существующие? *Рекомендация: добавить `*_all`, сырые оставить.*
4. **`repair_reweld` и `tmcp_pipe`** — одна колонка с `CASE` по `source` или две колонки
   (`*_wd` / `*_all`, как уже сделано для `service_class_cat_*`)?
   *Рекомендация: две, по образцу `service_class_cat_wd`/`service_class_cat_ndt`.*
5. **Четыре захардкоженных `Joint ID`** («EXLUDE 4 RT B.log CCC») — воспроизводим?
   *Рекомендация: да, но как строки в справочной таблице `weld_manual_exclusion`
   с комментарием, а не как литералы в коде.*
6. **`RT Weld Status = "HS CCC"`** — закрыт ruling R2-13 (воспроизводить дословно).
   Здесь только фиксирую полную формулу M, чтобы её не пришлось искать:
   `if [RT Report] = "blank" then "HS" else if [RT%] = 100 then "HS CCC" else if [Tracer Shot] = "T" then "T" else ""`.
   Обратите внимание на первую ветку: сравнение со **строкой** `"blank"`, а не с пустотой.
7. **`Weld Type` RPD*/SOB* схлопывание** — 17 последовательных `Replacer.ReplaceText`.
   Применяем ко всем источникам или только к не-`WELD_DUMP`? В M это делается **после**
   union, то есть ко всем. *Рекомендация: ко всем, порядок шагов сохранить.*
8. **`Calendar[Date]`** — подтвердить у владельца отчёта, что `Week_End_Date from Calendar`
   действительно матчится по дате календаря (метаданные колонки `Date` не отдают, §2.3).
9. **`HA l0_abs_guide`** (912 строк) — запросить файл; без него `ha` заполняется только для
   строк с валидным `subsystem_code`/`system_no`.
10. **`UT TRACKER (GAC)` и `UT TRACKER (TEK)`** (155 и 10 строк) — запросить; ruling R-05.
11. **`Testpack-wise Details Report`** (247 528 строк) — нужен для `Open_Punch_*` и
    `Reinstatement_Date`; файла нет.
12. **`PWHT Y/N CCC (NEW)`** содержит белый список из 13 `Joint ID` и переписанное правило
    PWHT, отличающееся от `PWHT Y/N CCC`; в модели есть колонка-сверка
    `PWHT Y/N CCC True/False Status`. Какое из двух правил считать нормативным?
    *Рекомендация: спросить владельца; по умолчанию — `PWHT Status PR ALL`, который
    использует старое `PWHT Y/N CCC`.*

---

## 6. Можно ли извлечь сами данные из pbix?

Коротко: **технически да, практически — не нужно.**

`DataModel` внутри .pbix — это 1 043 647 012-байтовый образ VertiPaq, сжатый Xpress9.
Предыдущая линия работ (`analysis/pbix/model.md`, раздел «How this was extracted») собрала
`libxpress9.so` из C-исходников `Hugoberry/xpress9-python` компилятором из wheel-пакета
`ziglang`, написала `ctypes`-обёртку с тем же API, что у Cython-расширения, и открыла файл
через `pbixray==0.15.5`. Так были получены **метаданные**: меры, вычисляемые колонки,
связи, M-запросы, схема и статистика — всё, на чём стоит этот документ.

Но **сами данные колонок** идут не через Xpress9, а через **xpress8** и **xmhuffman**,
и оба этих модуля в той сборке были **заглушены** (`stubbed`) — их не компилировали, потому
что для разбора метаданных они не нужны. Чтобы вытащить значения, пришлось бы:

1. собрать `xpress8` и `xmhuffman` тем же способом (исходники есть в том же репозитории);
2. разобрать словари и сегменты каждой из 425 колонок (`Dictionary`, `HashIndex`, `DataSize`
   в `column-statistics.json` — это и есть их размеры), 17,5 МБ только на `Joint ID`;
3. пересобрать 6 546 261 строку из RLE/hash-кодированных сегментов.

Это дни работы ради **снимка на 2026-08-30**, который нельзя обновить.

Между тем в `sources/` теперь лежат **все четыре источника union'а**:
`Weld Dump.txt`, `CSVExport_Welder Record.csv` (+ `… FOR PIC UPDATE (ACC REJ ).xlsx`),
`Acciona/Acciona_Latest Add to Query.xlsx`, `Inco/Master Weld_Latest.xlsx`,
а также пятый (`AllTrain_CSVExport_Joint Record.csv`) и справочники
`Spool Dump.txt`, `Weld Length/Weld Length.xlsx`, `UT TRACKER (CCC)_Talisman.xlsx`,
`Joint.csv`/`Spool.csv` (Talisman). Профиль первых пяти — в `analysis/sources2/profile.md`,
и там же зафиксировано, что число строк совпадает с pbix с точностью до 0,04 %
(5 430 732 против 5 433 009 — разные снимки, не разная логика).

**Вывод: извлечение из pbix закрыто как задача.** Строим живой ETL из файлов.

---

## Проверки

Все счётчики в документе воспроизводятся из сырого JSON:

```
$ export PATH="$HOME/.local/bin:$PATH"
$ uv run python -c "
import json,collections
T='Project WD+WR+INCO+Acciona'
cols=[c for c in json.load(open('analysis/pbix/raw/model/columns.json')) if c['TableName']==T]
print('total column rows for table:',len(cols))
print('by Type:',collections.Counter(c['Type'] for c in cols))
cc=[c for c in json.load(open('analysis/pbix/raw/model/calculated-columns.json')) if c['TableName']==T]
print('calculated-columns.json entries:',len(cc))
rc={r['TableName']:r['RowCount'] for r in json.load(open('analysis/pbix/raw/model/row-counts.json'))}
for t in [T,'Weld Dump','CSVExport_Welder Record','Acciona_Query','Inco Weld Log','AllTrain_CSVExport_Joint Record NOT WELDED']:
    print(t, rc.get(t))
"
total column rows for table: 425
by Type: Counter({1: 267, 2: 158})
calculated-columns.json entries: 158
Project WD+WR+INCO+Acciona 6546261
Weld Dump 958634
CSVExport_Welder Record 5433009
Acciona_Query 13313
Inco Weld Log 10327
AllTrain_CSVExport_Joint Record NOT WELDED 130994
```

| проверка | значение |
|---|---|
| импортированных + вычисляемых = всего | 267 + 158 = **425** ✓ |
| `calculated-columns.json` записей для таблицы | **158** (совпадает с `Type=2` в `columns.json`) ✓ |
| строк: 958 634 + 5 433 009 + 13 313 + 10 327 + 130 994 − 16 | **6 546 261** ✓ |
| мер, ссылающихся на таблицу в DAX | **200** |
| мер с `"PR all"` в имени | **171** (пересечение 131, объединение **240**) |
| визуалов с привязкой к таблице | **1 107** из 2 285 |
| страниц | **107** из 144 |
| различных полей таблицы в визуалах | **171** |
| вычисляемых колонок, не используемых нигде | **17** |
| импортированных колонок, не используемых нигде | **179** |
| висячих ссылок в DAX | 3 расхождения регистра (безвредны) + 1 неподтверждённая (`Calendar[Date]`) |
| строк в этом файле | см. `wc -l analysis/pbix/project-wd-wr-inco-acciona.md` |

Расхождения между источниками, отмеченные честно:

* `analysis/pbix/model.md` и `calculation-logic.md` §0.3 называют четыре источника union'а —
  их **пять** (§1.2). Это не ошибка чтения M, а пропущенный второй `Table.Combine`.
* `relationships.json` даёт `ToKeyCount = 6 546 264` там, где `row-counts.json` и
  `column-statistics.json[Index].Cardinality` дают 6 546 261 (§1.4).
* Замена `"#"` → `"CCC"` в `Sub-Contractor`, описанная в `calculation-logic.md` §1.1 как
  решающая улика, на **текущем** файле `CSVExport_Welder Record.csv` является no-op:
  `Sub-Con Code` там уже `CCC` во всех строках, а `#` лежит в `Original Joint` (§1.5).
  Вывод §1.1 («WR = данные CCC») от этого не меняется — он подтверждается и остальными
  четырьмя уликами.

---

## Приложение A. Все 425 колонок

Колонки: **kind** — imp (импортированная) / calc (вычисляемая);
**card.** — `Cardinality` из `column-statistics.json`;
**WD-shape** — колонка есть и в таблице `Weld Dump`;
**мер / виз / стр / калк** — сколько мер, визуалов, страниц и других вычисляемых колонок
её используют; **`weld`** — колонка нашей схемы (⚠ = коллизия имён, см. §5.3 п. 8).
Порядок: сначала 267 импортированных в порядке `DisplayOrdinal`, затем 158 вычисляемых.
Машиночитаемая версия с полным DAX — `analysis/pbix/raw/prall-columns.json`.

| # | column | kind | type | card. | WD-shape | meas. | vis. | pages | calc. | `weld` |
|---:|---|---|---|---:|:---:|---:|---:|---:|---:|---|
| 1 | `Joint ID` | imp | String | 2390991 | y | 99 | 144 | 55 | 61 | `joint_id` |
| 2 | `Spool ID` | imp | String | 521877 | y | 0 | 13 | 8 | 3 | `spool_id` |
| 3 | `ISO Number` | imp | String | 89536 | y | 0 | 8 | 6 | 3 | `iso_number` |
| 4 | `Iso Rev No.` | imp | String | 222 | y | 0 | 0 | 0 | 0 | `iso_rev_no` |
| 5 | `Spool No.` | imp | String | 1690 | y | 0 | 0 | 0 | 0 | `spool_no` |
| 6 | `Weld No.` | imp | String | 8737 | y | 0 | 1 | 1 | 0 | `weld_no` |
| 7 | `Spool Rev No.` | imp | String | 171 | y | 0 | 0 | 0 | 0 | `spool_rev_no` |
| 8 | `Weld Cat` | imp | String | 3 | y | 1 | 242 | 53 | 1 | `weld_cat` |
| 9 | `Weld Type` | imp | String | 22 | y | 43 | 364 | 84 | 10 | `weld_type` |
| 10 | `Dia Inch Factor` | imp | String | 2 | y | 2 | 1 | 1 | 0 | `dia_inch_factor` |
| 11 | `Dia inch` | imp | Double | 81 | y | 6 | 15 | 14 | 4 | `dia_inch` |
| 12 | `Thickness` | imp | Double | 345 | y | 0 | 10 | 8 | 2 | `thickness` |
| 13 | `PDS Area` | imp | String | 644 | y | 0 | 1 | 1 | 4 | `pds_area` |
| 14 | `AG/UG/PKG` | imp | String | 4 | y | 0 | 0 | 0 | 0 | `ag_ug_pkg` |
| 15 | `Area Classification` | imp | String | 22 | y | 0 | 22 | 14 | 2 | `area_classification` |
| 16 | `wbu` | imp | String | 12 | y | 0 | 0 | 0 | 0 | `wbu` |
| 17 | `System no` | imp | String | 539 | y | 0 | 0 | 0 | 0 | `system_no` |
| 18 | `Testpack No` | imp | String | 17875 | y | 0 | 0 | 0 | 1 | `testpack_no` |
| 19 | `NDT Remarks` | imp | String | 5 | y | 0 | 54 | 30 | 4 | `ndt_remarks` |
| 20 | `Service class` | imp | String | 250 | y | 0 | 93 | 35 | 6 | `service_class` |
| 21 | `Service Cat` | imp | String | 50 | y | 1 | 87 | 15 | 4 | `service_cat` |
| 22 | `Material Type` | imp | String | 90 | y | 0 | 18 | 8 | 3 | `material_type` |
| 23 | `MIR No` | imp | String | 1153 | y | 0 | 0 | 0 | 0 | `mir_no` |
| 24 | `MIR Date` | imp | DateTime | 588 | y | 0 | 0 | 0 | 0 | `mir_date` |
| 25 | `Cutting Date` | imp | DateTime | 1644 | y | 0 | 0 | 0 | 0 | `cutting_date` |
| 26 | `Beveling Date` | imp | DateTime | 1644 | y | 0 | 0 | 0 | 0 | `beveling_date` |
| 27 | `Fitup Date` | imp | DateTime | 1645 | y | 0 | 1 | 1 | 1 | `fitup_date` |
| 28 | `Preheat Date` | imp | DateTime | 1367 | y | 0 | 0 | 0 | 0 | `preheat_date` |
| 29 | `Weld Date` | imp | DateTime | 1639 | y | 94 | 114 | 54 | 17 | `weld_date` |
| 30 | `DWIR No.` | imp | String | 11597 | y | 2 | 4 | 3 | 1 | `dwir_no` |
| 31 | `Sub-Contractor` | imp | String | 6 | y | 17 | 549 | 95 | 33 | `sub_contractor` |
| 32 | `Rework Code` | imp | String | 23 | y | 0 | 0 | 0 | 1 | `rework_code` |
| 33 | `Original Joint` | imp | String | 4 | y | 1 | 0 | 0 | 0 | `original_joint` |
| 34 | `Repair Suffix` | imp | String | 10 | y | 0 | 13 | 11 | 1 | `repair_suffix` |
| 35 | `WeldPoint No.` | imp | Int64 | 34 | y | 9 | 2 | 1 | 0 | `weldpoint_no` |
| 36 | `Weld Point Code` | imp | String | 5 | y | 6 | 0 | 0 | 0 | `weld_point_code` |
| 37 | `WPS No.` | imp | String | 290 | y | 0 | 30 | 14 | 5 | `wps_no` |
| 38 | `Welder` | imp | String | 3896 | y | 0 | 73 | 27 | 1 | `welder` |
| 39 | `PWHT Y/N` | imp | String | 4 | y | 7 | 2 | 2 | 1 | `pwht_y_n` |
| 40 | `PWHT Weld Status` | imp | String | 4 | y | 14 | 0 | 0 | 0 | `pwht_weld_status` |
| 41 | `PWHT Selected Date` | imp | DateTime | 1185 | y | 0 | 0 | 0 | 0 | `pwht_selected_date` |
| 42 | `PWHT Exam Req date` | imp | DateTime | 1056 | y | 0 | 0 | 0 | 0 | `pwht_exam_req_date` |
| 43 | `PWHT Date` | imp | DateTime | 1225 | y | 0 | 0 | 0 | 1 | `pwht_date` |
| 44 | `PWHT Report` | imp | String | 32508 | y | 15 | 0 | 0 | 2 | `pwht_report` |
| 45 | `PWHT Acc/Rej` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `pwht_acc_rej` |
| 46 | `PWHT Client Exam Req Y/N` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `pwht_client_exam_req_y_n` |
| 47 | `PWHT Remarks` | imp | String | 16 | y | 0 | 0 | 0 | 0 | `pwht_remarks` |
| 48 | `HT%` | imp | Int64 | 2 | y | 0 | 0 | 0 | 1 | `ht_pct` |
| 49 | `HT Batch No` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 50 | `HT Batch Status` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 51 | `HT Weld Status` | imp | String | 4 | y | 0 | 0 | 0 | 0 | `ht_weld_status` |
| 52 | `HT Selected Date` | imp | DateTime | 1118 | y | 0 | 0 | 0 | 0 | `ht_selected_date` |
| 53 | `HT Exam Req date` | imp | DateTime | 928 | y | 0 | 0 | 0 | 0 | `ht_exam_req_date` |
| 54 | `HT Date` | imp | DateTime | 1152 | y | 0 | 0 | 0 | 1 | `ht_date` |
| 55 | `HT Report` | imp | String | 18668 | y | 0 | 0 | 0 | 1 | `ht_report` |
| 56 | `HT Acc/Rej` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `ht_acc_rej` |
| 57 | `HT Client Exam Req Y/N` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `ht_client_exam_req_y_n` |
| 58 | `HT Remarks` | imp | String | 7 | y | 0 | 9 | 5 | 1 | `ht_remarks` |
| 59 | `RT/UT` | imp | String | 3 | y | 2 | 7 | 4 | 8 | `rt_ut` |
| 60 | `RT%` | imp | Int64 | 6 | y | 37 | 113 | 39 | 5 | `rt_pct` |
| 61 | `RT Batch No` | imp | String | 14567 | y | 0 | 6 | 3 | 1 | `rt_batch_no` |
| 62 | `RT Batch Status` | imp | String | 4 | y | 0 | 1 | 1 | 0 | `rt_batch_status` |
| 63 | `RT Weld Status` | imp | String | 12 | y | 20 | 1 | 1 | 1 | `rt_weld_status` |
| 64 | `RT Selected Date` | imp | DateTime | 1276 | y | 0 | 0 | 0 | 1 | `rt_selected_date` |
| 65 | `RT Exam Req date` | imp | DateTime | 970 | y | 0 | 0 | 0 | 0 | `rt_exam_req_date` |
| 66 | `RT Date` | imp | DateTime | 1510 | y | 8 | 25 | 13 | 9 | `rt_date` |
| 67 | `RT Xray No` | imp | String | 44883 | y | 0 | 0 | 0 | 0 | `rt_xray_no` |
| 68 | `RT Report` | imp | String | 207405 | y | 47 | 89 | 39 | 15 | `rt_report` |
| 69 | `RT Acc/Rej` | imp | String | 4 | y | 43 | 25 | 11 | 11 | `rt_acc_rej` |
| 70 | `RT Film Total` | imp | Double | 167 | y | 9 | 2 | 2 | 8 | `rt_film_total` |
| 71 | `Total No of films Acc` | imp | Double | 185 | y | 3 | 1 | 1 | 0 | `total_no_of_films_acc` |
| 72 | `Total No of films Rej` | imp | Double | 20 | y | 6 | 3 | 2 | 8 | `total_no_of_films_rej` |
| 73 | `Defect Code` | imp | String | 46 | y | 0 | 4 | 3 | 1 | `defect_code` |
| 74 | `Location of Defect` | imp | String | 1013 | y | 0 | 0 | 0 | 0 | `location_of_defect` |
| 75 | `RT Re-Shoot Rep` | imp | String | 2008 | y | 0 | 4 | 2 | 1 | `rt_re_shoot_rep` |
| 76 | `RT Re-Shoot Data` | imp | DateTime | 759 | y | 3 | 3 | 1 | 0 | `rt_re_shoot_data` |
| 77 | `RT Re-Shoot Status` | imp | String | 4 | y | 0 | 0 | 0 | 1 | `rt_re_shoot_status` |
| 78 | `RT Re-Shoot Reason` | imp | String | 12 | y | 0 | 0 | 0 | 1 | `rt_re_shoot_reason` |
| 79 | `RT Re-Shoot Films` | imp | Int64 | 11 | y | 3 | 0 | 0 | 0 | `rt_re_shoot_films` |
| 80 | `Weld Length` | imp | Double | 579 | y | 0 | 6 | 3 | 1 | `weld_length` |
| 81 | `Rej Length` | imp | Double | 246 | y | 4 | 5 | 5 | 3 | `rej_length` |
| 82 | `RT Client Exam Req Y/N` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `rt_client_exam_req_y_n` |
| 83 | `By UT` | imp | String | 2 | y | 0 | 1 | 1 | 3 | `by_ut` |
| 84 | `RT Remarks` | imp | String | 661 | y | 1 | 0 | 0 | 0 | `rt_remarks` |
| 85 | `Tracer Shot` | imp | String | 9 | y | 0 | 0 | 0 | 0 | `tracer_shot` |
| 86 | `UT%` | imp | Int64 | 1 | y | 0 | 0 | 0 | 0 | `ut_pct` |
| 87 | `UT Batch No` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 88 | `UT Batch Status` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 89 | `UT Weld Status` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `ut_weld_status` |
| 90 | `UT Selected Date` | imp | DateTime | 501 | y | 0 | 0 | 0 | 0 | `ut_selected_date` |
| 91 | `UT Exam Req date` | imp | DateTime | 1 | y | 0 | 0 | 0 | 0 | — |
| 92 | `UT Date` | imp | DateTime | 762 | y | 0 | 1 | 1 | 2 | `ut_date` |
| 93 | `UT Report` | imp | String | 4797 | y | 2 | 1 | 1 | 3 | `ut_report` |
| 94 | `UT Acc/Rej` | imp | String | 3 | y | 0 | 3 | 2 | 2 | `ut_acc_rej` |
| 95 | `UT Client Exam Req Y/N` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `ut_client_exam_req_y_n` |
| 96 | `UT Remarks` | imp | String | 89 | y | 0 | 0 | 0 | 0 | `ut_remarks` |
| 97 | `MT%` | imp | Int64 | 4 | y | 0 | 1 | 1 | 1 | `mt_pct` |
| 98 | `MT Batch No` | imp | String | 142 | y | 0 | 0 | 0 | 0 | `mt_batch_no` |
| 99 | `MT Batch Status` | imp | String | 4 | y | 0 | 0 | 0 | 0 | `mt_batch_status` |
| 100 | `MT Weld Status` | imp | String | 5 | y | 1 | 0 | 0 | 0 | `mt_weld_status` |
| 101 | `MT Selected Date` | imp | DateTime | 1224 | y | 0 | 0 | 0 | 0 | `mt_selected_date` |
| 102 | `MT Exam Req date` | imp | DateTime | 958 | y | 0 | 0 | 0 | 0 | `mt_exam_req_date` |
| 103 | `MT Date` | imp | DateTime | 1160 | y | 0 | 0 | 0 | 1 | `mt_date` |
| 104 | `MT Report` | imp | String | 17840 | y | 1 | 0 | 0 | 2 | `mt_report` |
| 105 | `MT Acc/Rej` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `mt_acc_rej` |
| 106 | `MT Client Exam Req Y/N` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `mt_client_exam_req_y_n` |
| 107 | `MT Remarks` | imp | String | 39 | y | 0 | 0 | 0 | 0 | `mt_remarks` |
| 108 | `PMI%` | imp | Int64 | 3 | y | 0 | 0 | 0 | 1 | `pmi_pct` |
| 109 | `PMI Batch No` | imp | String | 3393 | y | 0 | 0 | 0 | 0 | `pmi_batch_no` |
| 110 | `PMI Batch Status` | imp | String | 4 | y | 0 | 0 | 0 | 0 | `pmi_batch_status` |
| 111 | `PMI Weld Status` | imp | String | 7 | y | 0 | 0 | 0 | 0 | `pmi_weld_status` |
| 112 | `PMI Selected Date` | imp | DateTime | 1058 | y | 0 | 0 | 0 | 0 | `pmi_selected_date` |
| 113 | `PMI Exam Req date` | imp | DateTime | 856 | y | 0 | 0 | 0 | 0 | `pmi_exam_req_date` |
| 114 | `PMI Date` | imp | DateTime | 1015 | y | 0 | 0 | 0 | 1 | `pmi_date` |
| 115 | `PMI Report` | imp | String | 23271 | y | 0 | 0 | 0 | 2 | `pmi_report` |
| 116 | `PMI Acc/Rej` | imp | String | 3 | y | 0 | 0 | 0 | 0 | `pmi_acc_rej` |
| 117 | `PMI Client Exam Req Y/N` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `pmi_client_exam_req_y_n` |
| 118 | `PMI Remarks` | imp | String | 8 | y | 0 | 0 | 0 | 0 | `pmi_remarks` |
| 119 | `PT%` | imp | Int64 | 5 | y | 0 | 0 | 0 | 1 | `pt_pct` |
| 120 | `PT Batch No` | imp | String | 218 | y | 0 | 0 | 0 | 0 | `pt_batch_no` |
| 121 | `PT Batch Status` | imp | String | 3 | y | 0 | 0 | 0 | 0 | `pt_batch_status` |
| 122 | `PT Weld Status` | imp | String | 4 | y | 0 | 0 | 0 | 0 | `pt_weld_status` |
| 123 | `PT Selected Date` | imp | DateTime | 1054 | y | 0 | 0 | 0 | 0 | `pt_selected_date` |
| 124 | `PT Exam Req date` | imp | DateTime | 750 | y | 0 | 0 | 0 | 0 | `pt_exam_req_date` |
| 125 | `PT Date` | imp | DateTime | 1005 | y | 0 | 0 | 0 | 1 | `pt_date` |
| 126 | `PT Report` | imp | String | 15041 | y | 0 | 0 | 0 | 2 | `pt_report` |
| 127 | `PT Acc/Rej` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `pt_acc_rej` |
| 128 | `PT Client Exam Req Y/N` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `pt_client_exam_req_y_n` |
| 129 | `PT Remarks` | imp | String | 27 | y | 0 | 0 | 0 | 0 | `pt_remarks` |
| 130 | `FN%` | imp | Int64 | 1 | y | 0 | 0 | 0 | 0 | `fn_pct` |
| 131 | `FN Batch No` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 132 | `FN Batch Status` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 133 | `FN Weld Status` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 134 | `FN Selected Date` | imp | DateTime | 1 | y | 0 | 0 | 0 | 0 | — |
| 135 | `FN Exam Req date` | imp | DateTime | 1 | y | 0 | 0 | 0 | 0 | — |
| 136 | `FN Date` | imp | DateTime | 1 | y | 0 | 0 | 0 | 0 | — |
| 137 | `FN Report` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 138 | `FN Acc/Rej` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 139 | `FN Client Exam Req Y/N` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 140 | `FN Remarks` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 141 | `PADLT Y/N` | imp | String | 3 | y | 0 | 0 | 0 | 0 | `padlt_y_n` |
| 142 | `PADLT Weld Status` | imp | String | 3 | y | 0 | 0 | 0 | 0 | `padlt_weld_status` |
| 143 | `PADLT Selected Date` | imp | DateTime | 382 | y | 0 | 0 | 0 | 0 | `padlt_selected_date` |
| 144 | `PADLT Exam Req date` | imp | DateTime | 277 | y | 0 | 0 | 0 | 0 | `padlt_exam_req_date` |
| 145 | `PADLT Date` | imp | DateTime | 444 | y | 0 | 2 | 1 | 0 | `padlt_date` |
| 146 | `PADLT Report` | imp | String | 650 | y | 4 | 5 | 3 | 3 | `padlt_report` |
| 147 | `PADLT Acc/Rej` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `padlt_acc_rej` |
| 148 | `PADLT Client Exam Req Y/N` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `padlt_client_exam_req_y_n` |
| 149 | `PADLT Remarks` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 150 | `ORIF Y/N` | imp | String | 3 | y | 0 | 0 | 0 | 0 | `orif_y_n` |
| 151 | `ORIF Weld Status` | imp | String | 4 | y | 0 | 0 | 0 | 0 | `orif_weld_status` |
| 152 | `ORIF Selected Date` | imp | DateTime | 247 | y | 0 | 0 | 0 | 0 | `orif_selected_date` |
| 153 | `ORIF Exam Req date` | imp | DateTime | 153 | y | 0 | 0 | 0 | 0 | `orif_exam_req_date` |
| 154 | `ORIF Date` | imp | DateTime | 233 | y | 0 | 0 | 0 | 0 | `orif_date` |
| 155 | `ORIF Report` | imp | String | 610 | y | 4 | 6 | 3 | 3 | `orif_report` |
| 156 | `ORIF Acc/Rej` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `orif_acc_rej` |
| 157 | `ORIF Client Exam Req Y/N` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `orif_client_exam_req_y_n` |
| 158 | `Matrl Traceability Y/N` | imp | String | 3 | y | 0 | 0 | 0 | 0 | `matrl_traceability_y_n` |
| 159 | `GROUP-1` | imp | String | 10 | y | 0 | 0 | 0 | 0 | `group_1` |
| 160 | `IDENT CODE-1` | imp | String | 6650 | y | 0 | 0 | 0 | 0 | `ident_code_1` |
| 161 | `TRAC NO-1` | imp | String | 21470 | y | 0 | 0 | 0 | 0 | `trac_no_1` |
| 162 | `Part 1` | imp | String | 7379 | y | 0 | 0 | 0 | 0 | `part_1` |
| 163 | `GROUP-2` | imp | String | 10 | y | 0 | 0 | 0 | 0 | `group_2` |
| 164 | `IDENT CODE-2` | imp | String | 9333 | y | 0 | 0 | 0 | 0 | `ident_code_2` |
| 165 | `TRAC NO-2` | imp | String | 24880 | y | 0 | 0 | 0 | 0 | `trac_no_2` |
| 166 | `Part 2` | imp | String | 9855 | y | 0 | 0 | 0 | 0 | `part_2` |
| 167 | `Revision Status` | imp | String | 1 | y | 0 | 0 | 0 | 0 | `revision_status` |
| 168 | `Revision Comments` | imp | String | 40 | y | 0 | 0 | 0 | 0 | `revision_comments` |
| 169 | `Hold Status` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `hold_status` |
| 170 | `Hold Comments` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `hold_comments` |
| 171 | `Piping Group` | imp | String | 5 | y | 0 | 0 | 0 | 0 | `piping_group` |
| 172 | `Golden Weld Report Date` | imp | String | 4 | y | 0 | 0 | 0 | 0 | `golden_weld_report_date` |
| 173 | `Golden Weld Report No` | imp | String | 3 | y | 0 | 0 | 0 | 0 | `golden_weld_report_no` |
| 174 | `Custom3` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 175 | `Custom4` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 176 | `Custom5` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 177 | `Custom6` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 178 | `Custom7` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 179 | `Custom8` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 180 | `Custom9` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 181 | `Custom10` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 182 | `Custom11` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 183 | `Custom12` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 184 | `Custom13` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 185 | `Custom14` | imp | String | 3 |  | 0 | 1 | 1 | 0 | — |
| 186 | `Subsystem Code` | imp | String | 1449 | y | 0 | 0 | 0 | 1 | `subsystem_code` |
| 187 | `PED` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 188 | `Aditional Joint No.RT` | imp | String | 1605 |  | 0 | 0 | 0 | 0 | — |
| 189 | `Repair Length (mm)` | imp | Int64 | 36 |  | 4 | 13 | 3 | 3 | — |
| 190 | `RT P1 Rep.` | imp | String | 9 |  | 0 | 0 | 0 | 0 | — |
| 191 | `P1 Date` | imp | DateTime | 1 |  | 0 | 0 | 0 | 0 | — |
| 192 | `RT P2 Rep.` | imp | String | 2 |  | 0 | 0 | 0 | 0 | — |
| 193 | `P2 Date` | imp | DateTime | 1 |  | 0 | 0 | 0 | 0 | — |
| 194 | `Category 1` | imp | String | 8 |  | 0 | 0 | 0 | 0 | — |
| 195 | `Category 2` | imp | String | 47 |  | 0 | 0 | 0 | 0 | — |
| 196 | `Drg No` | imp | String | 118 |  | 0 | 0 | 0 | 0 | — |
| 197 | `process` | imp | String | 15 |  | 0 | 0 | 0 | 0 | — |
| 198 | `Fitup Report No.` | imp | String | 1746 |  | 0 | 0 | 0 | 0 | — |
| 199 | `First Prod. Joint` | imp | String | 19 |  | 0 | 0 | 0 | 0 | — |
| 200 | `VBT Report` | imp | String | 380 |  | 2 | 2 | 2 | 3 | — |
| 201 | `VBT Date` | imp | DateTime | 253 |  | 0 | 0 | 0 | 0 | — |
| 202 | `OPT Report` | imp | String | 66 |  | 0 | 1 | 1 | 2 | — |
| 203 | `OPT Date` | imp | DateTime | 65 |  | 0 | 0 | 0 | 0 | — |
| 204 | `Weld Point First` | imp | String | 1 |  | 1 | 0 | 0 | 0 | — |
| 205 | `Commissioning Package` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 206 | `TPI Cross Checked` | imp | String | 16 | y | 0 | 1 | 1 | 0 | `tpi_cross_checked` |
| 207 | `Checked Date` | imp | DateTime | 18 | y | 0 | 1 | 1 | 0 | `checked_date` |
| 208 | `Result (A/R)` | imp | String | 2 | y | 0 | 1 | 1 | 0 | `result_a_r` |
| 209 | `UT Operator ID` | imp | String | 9 | y | 0 | 1 | 1 | 1 | `ut_operator_id`  ⚠ |
| 210 | `Manual UT Date` | imp | DateTime | 250 | y | 0 | 1 | 1 | 1 | `manual_ut_date`  ⚠ |
| 211 | `Manual UT Report No` | imp | String | 1118 | y | 0 | 1 | 1 | 1 | `manual_ut_report_no`  ⚠ |
| 212 | `Manual UT Status` | imp | String | 3 | y | 0 | 3 | 3 | 2 | `manual_ut_status`  ⚠ |
| 213 | `FT Report` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 214 | `CountDelimiter` | imp | Int64 | 13 |  | 0 | 0 | 0 | 0 | — |
| 215 | `Count Rows.Count` | imp | Int64 | 14 |  | 0 | 0 | 0 | 0 | — |
| 216 | `Index` | imp | Int64 | 6546261 |  | 0 | 0 | 0 | 1 | — |
| 217 | `PWHT Selected By` | imp | String | 33 | y | 0 | 0 | 0 | 0 | `pwht_selected_by` |
| 218 | `PWHT Exam Req No` | imp | String | 2939 | y | 0 | 0 | 0 | 0 | `pwht_exam_req_no` |
| 219 | `PWHT Exam Req By` | imp | String | 12 | y | 0 | 0 | 0 | 0 | `pwht_exam_req_by` |
| 220 | `HT Selected By` | imp | String | 34 | y | 0 | 0 | 0 | 0 | `ht_selected_by` |
| 221 | `HT Exam Req No` | imp | String | 1612 | y | 0 | 0 | 0 | 0 | `ht_exam_req_no` |
| 222 | `HT Exam Req By` | imp | String | 9 | y | 0 | 0 | 0 | 0 | `ht_exam_req_by` |
| 223 | `RT Selected By` | imp | String | 39 | y | 0 | 0 | 0 | 0 | `rt_selected_by` |
| 224 | `RT Exam Req No` | imp | String | 3674 | y | 0 | 0 | 0 | 0 | `rt_exam_req_no` |
| 225 | `RT Exam Req By` | imp | String | 13 | y | 0 | 0 | 0 | 0 | `rt_exam_req_by` |
| 226 | `UT Selected By` | imp | String | 26 | y | 0 | 0 | 0 | 0 | `ut_selected_by` |
| 227 | `UT Exam Req No` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 228 | `UT Exam Req By` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 229 | `MT Selected By` | imp | String | 34 | y | 0 | 0 | 0 | 0 | `mt_selected_by` |
| 230 | `MT Exam Req No` | imp | String | 1951 | y | 0 | 0 | 0 | 0 | `mt_exam_req_no` |
| 231 | `MT Exam Req By` | imp | String | 10 | y | 0 | 0 | 0 | 0 | `mt_exam_req_by` |
| 232 | `PMI Selected By` | imp | String | 31 | y | 0 | 0 | 0 | 0 | `pmi_selected_by` |
| 233 | `PMI Exam Req No` | imp | String | 2225 | y | 0 | 0 | 0 | 0 | `pmi_exam_req_no` |
| 234 | `PMI Exam Req By` | imp | String | 7 | y | 0 | 0 | 0 | 0 | `pmi_exam_req_by` |
| 235 | `PT Selected By` | imp | String | 31 | y | 0 | 0 | 0 | 0 | `pt_selected_by` |
| 236 | `PT Exam Req No` | imp | String | 1400 | y | 0 | 0 | 0 | 0 | `pt_exam_req_no` |
| 237 | `PT Exam Req By` | imp | String | 7 | y | 0 | 0 | 0 | 0 | `pt_exam_req_by` |
| 238 | `FN Selected By` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 239 | `FN Exam Req No` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 240 | `FN Exam Req By` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 241 | `PADLT Selected By` | imp | String | 13 | y | 0 | 0 | 0 | 0 | `padlt_selected_by` |
| 242 | `PADLT Exam Req No` | imp | String | 331 | y | 0 | 0 | 0 | 0 | `padlt_exam_req_no` |
| 243 | `PADLT Exam Req By` | imp | String | 6 | y | 0 | 0 | 0 | 0 | `padlt_exam_req_by` |
| 244 | `ORIF Selected By` | imp | String | 17 | y | 0 | 0 | 0 | 0 | `orif_selected_by` |
| 245 | `ORIF Exam Req No` | imp | String | 174 | y | 0 | 0 | 0 | 0 | `orif_exam_req_no` |
| 246 | `ORIF Exam Req By` | imp | String | 6 | y | 0 | 0 | 0 | 0 | `orif_exam_req_by` |
| 247 | `Priority No` | imp | String | 52 | y | 0 | 0 | 0 | 0 | `priority_no` |
| 248 | `GWBS` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 249 | `PDS Area Type` | imp | String | 2 | y | 0 | 0 | 0 | 0 | `pds_area_type` |
| 250 | `SHIPMENT DATE` | imp | String | 51 | y | 0 | 0 | 0 | 0 | `shipment_date` |
| 251 | ` SHIPMENT RECV DATE` | imp | String | 21 | y | 0 | 0 | 0 | 0 | `shipment_recv_date` |
| 252 | ` EREC MIR DATE` | imp | String | 158 | y | 0 | 0 | 0 | 0 | `erec_mir_date` |
| 253 | ` EREC MIR NO` | imp | String | 204 | y | 0 | 0 | 0 | 0 | `erec_mir_no` |
| 254 | ` SHEET NO` | imp | String | 227 | y | 0 | 0 | 0 | 0 | `sheet_no` |
| 255 | `PIP-001-A` | imp | String | 7795 | y | 0 | 0 | 0 | 0 | `pip_001_a` |
| 256 | `W24DWIR` | imp | String | 4485 | y | 0 | 0 | 0 | 0 | `w24dwir` |
| 257 | `BHS` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 258 | ` TESTPACK SUB CONTRACTOR` | imp | String | 4 | y | 0 | 0 | 0 | 0 | `testpack_sub_contractor` |
| 259 | ` TESTPACK TEST DONE DATE` | imp | DateTime | 796 | y | 0 | 4 | 3 | 0 | `testpack_test_done_date` |
| 260 | `PIP-124-A` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 261 | `WHS` | imp | String | 1 | y | 0 | 0 | 0 | 0 | — |
| 262 | `PACKING LIST NO` | imp | String | 19 | y | 0 | 0 | 0 | 0 | `packing_list_no` |
| 263 | `Last Reshoot Date.1` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 264 | `Last Reshoot Report No.1` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 265 | `Last Reshoot Result.1` | imp | String | 1 |  | 0 | 0 | 0 | 0 | — |
| 266 | `Golden Weld` | imp | String | 3 | y | 0 | 0 | 0 | 0 | `golden_weld` |
| 267 | `Joint ID for Heat N` | imp | String | 2390974 |  | 0 | 0 | 0 | 0 | — |
| 268 | `Repair & Reweld "PR all"` | calc | Automatic | 4 |  | 28 | 17 | 11 | 2 | — |
| 269 | `No of Days "PR all"` | calc | Automatic | 1639 |  | 10 | 0 | 0 | 0 | — |
| 270 | `Last_Weld Date "PR all"` | calc | Automatic | 1639 |  | 0 | 0 | 0 | 1 | — |
| 271 | `Days Since Last Weld` | calc | Automatic | 1639 | y | 3 | 0 | 0 | 0 | — |
| 272 | `RT Film Ratio % "PR all" For Welder` | calc | Automatic | 744 |  | 0 | 0 | 0 | 1 | — |
| 273 | `RT FILM Ratio % STATUS "PR all"` | calc | Automatic | 4 |  | 0 | 74 | 21 | 0 | — |
| 274 | `PWHT Y/N CCC` | calc | Automatic | 2 |  | 17 | 12 | 10 | 2 | `pwht_y_n_ccc` |
| 275 | `PWHT Report No CCC` | calc | Automatic | 38162 |  | 16 | 6 | 4 | 3 | `pwht_report_no_ccc` |
| 276 | `PWHT Date No CCC` | calc | Automatic | 1296 |  | 0 | 0 | 0 | 1 | `pwht_date_no_ccc` |
| 277 | `MT Report CCC` | calc | Automatic | 94815 |  | 1 | 0 | 0 | 2 | — |
| 278 | `MT Date CCC` | calc | Automatic | 1560 |  | 0 | 0 | 0 | 1 | — |
| 279 | `MT% CCC` | calc | Automatic | 4 |  | 0 | 2 | 2 | 1 | — |
| 280 | `Total Welded Dia "PR all" Table` | calc | Automatic | 78 |  | 8 | 0 | 0 | 0 | — |
| 281 | `% of Total Reject` | calc | Automatic | 1 |  | 0 | 0 | 0 | 0 | — |
| 282 | `Service Class + Service Cat+NDT Remarks` | calc | Automatic | 948 |  | 7 | 89 | 33 | 5 | — |
| 283 | `RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"` | calc | Automatic | 253 |  | 0 | 18 | 9 | 1 | — |
| 284 | `RT FILM Ratio % STATUS for Service Class By SUBCON "PR all"` | calc | Automatic | 4 |  | 0 | 24 | 11 | 0 | — |
| 285 | `RT Ratio % For Welder (<5% ; >5%) "PR all"` | calc | Automatic | 2256 |  | 0 | 2 | 2 | 1 | — |
| 286 | `RT Ratio % STATUS for Welder Cover 5% "PR all"` | calc | Automatic | 3 |  | 0 | 80 | 25 | 0 | — |
| 287 | `No of Days Fit-UP - TODAY "PR all"` | calc | Automatic | 58 |  | 0 | 1 | 1 | 1 | — |
| 288 | `No Of Days Fit-UP - Today STATUS "PR all"` | calc | Automatic | 5 |  | 0 | 3 | 1 | 0 | — |
| 289 | `No of Days Weld Date - TODAY "PR all"` | calc | Automatic | 184 |  | 0 | 2 | 1 | 1 | — |
| 290 | `No Of Days Weld Date - Today RT STATUS "PR all"` | calc | Automatic | 5 |  | 0 | 3 | 1 | 0 | — |
| 291 | `Welder ID` | calc | Automatic | 3940 |  | 19 | 140 | 39 | 15 | — |
| 292 | `Joint Uniq "PR all" Column` | calc | Automatic | 1 |  | 0 | 0 | 0 | 0 | — |
| 293 | `Last_RT Date "PR all"` | calc | Automatic | 1505 |  | 6 | 13 | 6 | 3 | — |
| 294 | `Days Since Last RT` | calc | Int64 | 1505 |  | 16 | 46 | 9 | 4 | — |
| 295 | `RT Film Ratio % "PR all" For Welder LAST 2 WEEKS` | calc | Automatic | 3 |  | 0 | 27 | 9 | 1 | — |
| 296 | `RT FILM Ratio % STATUS LAST 2 WEEKS` | calc | Automatic | 2 |  | 0 | 105 | 20 | 0 | — |
| 297 | `2 weeks Period for RT` | calc | Automatic | 37 |  | 0 | 4 | 1 | 0 | — |
| 298 | `Report TYPE` | calc | Automatic | 6 |  | 0 | 0 | 0 | 0 | — |
| 299 | `TMCP Pipe` | calc | Automatic | 1 | y | 1 | 68 | 14 | 0 | `tmcp_pipe` |
| 300 | `Weld Length "PR all"` | calc | Automatic | 85 |  | 3 | 0 | 0 | 1 | — |
| 301 | `PWHT Status PR ALL` | calc | Automatic | 3 |  | 0 | 4 | 4 | 0 | — |
| 302 | `TESTPACK No "PR All"` | calc | Automatic | 29456 |  | 4 | 9 | 4 | 7 | — |
| 303 | `TP Ratio % Complete "PR all"` | calc | Automatic | 2235 |  | 0 | 0 | 0 | 1 | — |
| 304 | `TP Ratio % STATUS` | calc | Automatic | 4 |  | 0 | 1 | 1 | 0 | — |
| 305 | `UT Report "PR All"` | calc | Automatic | 14208 |  | 1 | 9 | 8 | 1 | — |
| 306 | `UT Ratio % For Welder (<5% ; >5%) "PR all"` | calc | Automatic | 1290 |  | 0 | 0 | 0 | 0 | — |
| 307 | `UT Operator ID.` | calc | Automatic | 23 |  | 0 | 4 | 3 | 0 | `ut_operator_id`  ⚠ |
| 308 | `Manual UT Date.` | calc | DateTime | 862 |  | 0 | 1 | 1 | 3 | `manual_ut_date`  ⚠ |
| 309 | `Manual UT Report No.` | calc | Automatic | 14207 |  | 17 | 7 | 6 | 12 | `manual_ut_report_no`  ⚠ |
| 310 | `Manual UT Status.` | calc | Automatic | 3 |  | 8 | 1 | 1 | 3 | `manual_ut_status`  ⚠ |
| 311 | `Inspected Length(MM).` | calc | Automatic | 44 |  | 3 | 0 | 0 | 3 | — |
| 312 | `Defect Length(MM).` | calc | Double | 160 |  | 3 | 2 | 2 | 3 | — |
| 313 | `Cross Verification-by CTJV (TPI).` | calc | Automatic | 3 |  | 0 | 0 | 0 | 0 | — |
| 314 | `CTJV VERIFICATION Date.` | calc | Automatic | 11 |  | 0 | 0 | 0 | 0 | — |
| 315 | `CTJV VERIFICATION BY.` | calc | Automatic | 1 |  | 0 | 0 | 0 | 0 | — |
| 316 | `UT Rej Length Rate % "PR all" For Welder` | calc | Automatic | 302 |  | 0 | 13 | 10 | 1 | — |
| 317 | `UT Rej Rate % STATUS for Welder by Length` | calc | Automatic | 3 |  | 0 | 7 | 5 | 0 | — |
| 318 | `UT Rej Rate % "PR all" For Welder by Joint` | calc | Automatic | 108 |  | 0 | 12 | 9 | 1 | — |
| 319 | `UT Rej Rate % STATUS for Welder by Joint` | calc | Automatic | 2 |  | 0 | 6 | 4 | 0 | — |
| 320 | `UT Rej Rate % by joint "PR all" For Sub-Con` | calc | Automatic | 4 |  | 0 | 0 | 0 | 1 | — |
| 321 | `UT Rej Rate % STATUS for Sub-Con by Joint` | calc | Automatic | 2 |  | 0 | 6 | 4 | 0 | — |
| 322 | `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"` | calc | Automatic | 370 |  | 0 | 30 | 8 | 1 | — |
| 323 | `PWHT Report "PR All"` | calc | Automatic | 70665 |  | 5 | 8 | 7 | 3 | — |
| 324 | `PWHT Date "PR All"` | calc | Automatic | 1342 |  | 0 | 2 | 2 | 0 | — |
| 325 | `UT Date "PR All"` | calc | Automatic | 862 |  | 0 | 1 | 1 | 1 | — |
| 326 | `MT Report "PR All"` | calc | Automatic | 112653 |  | 6 | 9 | 6 | 3 | — |
| 327 | `MT Date "PR All"` | calc | Automatic | 1577 |  | 2 | 1 | 1 | 0 | — |
| 328 | `MT % "PR All"` | calc | Automatic | 4 |  | 0 | 1 | 1 | 0 | — |
| 329 | `PMI Report CCC` | calc | Automatic | 81791 |  | 0 | 0 | 0 | 1 | — |
| 330 | `PMI Date CCC` | calc | Automatic | 1127 |  | 0 | 0 | 0 | 1 | — |
| 331 | `PMI% CCC` | calc | Int64 | 1 |  | 0 | 0 | 0 | 1 | — |
| 332 | `PMI % "PR All"` | calc | Automatic | 3 |  | 0 | 0 | 0 | 0 | — |
| 333 | `PMI Report "PR All"` | calc | Automatic | 105061 |  | 4 | 5 | 4 | 3 | — |
| 334 | `PMI Date "PR All"` | calc | Automatic | 1150 |  | 0 | 1 | 1 | 0 | — |
| 335 | `PT% CCC` | calc | Automatic | 3 |  | 0 | 0 | 0 | 1 | — |
| 336 | `PT Report CCC` | calc | Automatic | 58767 |  | 0 | 0 | 0 | 1 | — |
| 337 | `PT Date CCC` | calc | Automatic | 1111 |  | 0 | 0 | 0 | 1 | — |
| 338 | `PT % "PR All"` | calc | Automatic | 5 |  | 0 | 1 | 1 | 0 | — |
| 339 | `PT Report "PR All"` | calc | Automatic | 73807 |  | 6 | 8 | 5 | 3 | — |
| 340 | `PT Date "PR All"` | calc | Automatic | 1143 |  | 2 | 1 | 1 | 0 | — |
| 341 | `HT Report CCC` | calc | Automatic | 76459 |  | 0 | 0 | 0 | 1 | — |
| 342 | `HT Date CCC` | calc | Automatic | 1289 |  | 0 | 0 | 0 | 1 | — |
| 343 | `HT% CCC` | calc | Automatic | 1 |  | 0 | 0 | 0 | 1 | — |
| 344 | `HT % "PR All"` | calc | Automatic | 2 |  | 0 | 0 | 0 | 0 | — |
| 345 | `HT Report "PR All"` | calc | Automatic | 95126 |  | 4 | 5 | 4 | 3 | — |
| 346 | `HT Date "PR All"` | calc | Automatic | 1324 |  | 0 | 1 | 1 | 0 | — |
| 347 | `UT Rej Rate % by Length "PR all" For Sub-Con` | calc | Automatic | 4 |  | 0 | 0 | 0 | 1 | — |
| 348 | `UT Rej Rate % STATUS for Sub-Con by Length` | calc | Automatic | 1 |  | 0 | 6 | 4 | 0 | — |
| 349 | `RT Film Ratio % "PR all" For Welder LAST 1 MONTH` | calc | Automatic | 12 |  | 0 | 9 | 4 | 1 | — |
| 350 | `RT FILM Ratio % STATUS LAST 1 Month` | calc | Automatic | 4 |  | 0 | 16 | 4 | 0 | — |
| 351 | `CROSS CHECK DATA & Talisman JOINT ID` | calc | Automatic | 1469921 |  | 0 | 3 | 2 | 0 | — |
| 352 | `RT CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 5 | 4 | 2 | 0 | — |
| 353 | `MT CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 5 | 5 | 2 | 0 | — |
| 354 | `PWHT CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 5 | 4 | 2 | 0 | — |
| 355 | `UT CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 5 | 4 | 2 | 0 | — |
| 356 | `PMI CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 5 | 4 | 2 | 0 | — |
| 357 | `PT CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 5 | 4 | 2 | 0 | — |
| 358 | `HT CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 5 | 4 | 2 | 0 | — |
| 359 | `ORIF CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 5 | 5 | 2 | 0 | — |
| 360 | `PADLT CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 5 | 4 | 2 | 0 | — |
| 361 | `UT Status TR/FL` | calc | Automatic | 2 |  | 0 | 2 | 1 | 0 | — |
| 362 | `Spool ID Status` | calc | Automatic | 2 |  | 4 | 1 | 1 | 0 | — |
| 363 | `UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS` | calc | Automatic | 2 |  | 0 | 17 | 8 | 1 | — |
| 364 | `UT Rej Rate % STATUS for Welder by Length Last 2 Weeks` | calc | Automatic | 1 |  | 0 | 19 | 6 | 0 | — |
| 365 | `Last_UT Date "PR all"` | calc | Automatic | 862 |  | 1 | 1 | 1 | 1 | — |
| 366 | `Days Since Last UT` | calc | Automatic | 862 |  | 5 | 9 | 1 | 1 | — |
| 367 | `VI CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 5 | 4 | 2 | 0 | — |
| 368 | `Spool ID CCC PWHT Status` | calc | Automatic | 2 |  | 1 | 1 | 1 | 0 | — |
| 369 | `VBT CROSS CHECK PRJ Data & FRB` | calc | Automatic | 1 |  | 2 | 0 | 0 | 0 | — |
| 370 | `LINE` | calc | Automatic | 79855 |  | 0 | 0 | 0 | 0 | — |
| 371 | `First_Weld Date "PR all"` | calc | Automatic | 1639 |  | 0 | 0 | 0 | 1 | — |
| 372 | `Days Since First Weld` | calc | Automatic | 1639 |  | 0 | 0 | 0 | 0 | — |
| 373 | `Dia Inch >20<` | calc | Automatic | 2 |  | 0 | 11 | 11 | 0 | — |
| 374 | `WeldPoint No.1 WP1` | calc | Automatic | 32 |  | 14 | 0 | 0 | 0 | — |
| 375 | `Duplicate Weld Date` | calc | Automatic | 4 |  | 0 | 7 | 7 | 0 | — |
| 376 | `Duplicate RT Date` | calc | Automatic | 5 |  | 0 | 3 | 3 | 0 | — |
| 377 | `TP Complete %` | calc | Automatic | 2235 |  | 0 | 1 | 1 | 0 | — |
| 378 | `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all" STATUS` | calc | Automatic | 2 |  | 0 | 17 | 8 | 0 | — |
| 379 | `BATCH QTY Joints` | calc | Automatic | 28 |  | 0 | 1 | 1 | 0 | — |
| 380 | `QTY Welder ID & No RT by Service Class + Service Cat+NDT Remarks` | calc | Automatic | 204 |  | 0 | 0 | 0 | 0 | — |
| 381 | `Has_RT_Report` | calc | Automatic | 404 |  | 0 | 0 | 0 | 0 | — |
| 382 | `Service Class + Service Cat+NDT Remarks+Welder ID` | calc | Automatic | 133048 |  | 3 | 0 | 0 | 0 | — |
| 383 | `Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS` | calc | Automatic | 1 |  | 0 | 4 | 2 | 1 | — |
| 384 | `Inco Rej Rate % STATUS for Welder by Length Last 2 Weeks` | calc | Automatic | 1 |  | 0 | 9 | 4 | 0 | — |
| 385 | `Inco Length Ratio % "PR all" For Welder LAST 1 Month` | calc | Automatic | 1 |  | 0 | 2 | 1 | 1 | — |
| 386 | `Inco Rej Rate % STATUS for Welder by Length Last 1 Month` | calc | Automatic | 1 |  | 0 | 4 | 2 | 0 | — |
| 387 | `Status Fabricated from "WD"` | calc | Automatic | 2 |  | 0 | 0 | 0 | 0 | — |
| 388 | `Status Spool NDE from "WD"` | calc | Automatic | 3 |  | 0 | 0 | 0 | 0 | — |
| 389 | `Last Spool Status from "WD"` | calc | Automatic | 6 |  | 0 | 0 | 0 | 0 | — |
| 390 | `Weld CAT (NEW)` | calc | Automatic | 3 |  | 0 | 8 | 8 | 0 | — |
| 391 | `Duplicate RT Report` | calc | Automatic | 7 |  | 0 | 2 | 1 | 0 | — |
| 392 | `By UT All` | calc | Automatic | 1 |  | 0 | 5 | 5 | 0 | — |
| 393 | `PWHT Y/N CCC (NEW)` | calc | Automatic | 2 |  | 1 | 7 | 5 | 1 | — |
| 394 | `PWHT Y/N CCC True/False Status` | calc | Automatic | 3 |  | 0 | 2 | 2 | 0 | — |
| 395 | `Thickness From "JR"` | calc | Automatic | 63 |  | 0 | 1 | 1 | 1 | — |
| 396 | `Thickness from "JR" True/False Status` | calc | Automatic | 3 |  | 0 | 2 | 1 | 0 | — |
| 397 | `WPS From "Talisman"` | calc | Automatic | 87 |  | 0 | 4 | 2 | 1 | — |
| 398 | `WPS from "Talisman" True/False Status` | calc | Automatic | 3 |  | 0 | 2 | 2 | 0 | — |
| 399 | `DWIR CCC From "JR"` | calc | Automatic | 546095 |  | 0 | 0 | 0 | 1 | — |
| 400 | `DWIR Report "PR All"` | calc | Automatic | 557690 |  | 2 | 2 | 2 | 3 | — |
| 401 | `HA` | calc | Automatic | 4 |  | 4 | 24 | 15 | 0 | `ha` |
| 402 | `Days Between RT Selected and RT Date` | calc | Automatic | 754 |  | 0 | 0 | 0 | 0 | — |
| 403 | `Duplicate RT Report by Joint` | calc | Automatic | 16 |  | 0 | 2 | 1 | 0 | — |
| 404 | `Week_End_Date from Calendar` | calc | Automatic | 245 |  | 0 | 15 | 8 | 0 | — |
| 405 | `MonthRT` | calc | DateTime | 1510 |  | 0 | 6 | 4 | 0 | — |
| 406 | `YearRT` | calc | Automatic | 7 |  | 0 | 14 | 8 | 0 | — |
| 407 | `Exlude Full Cut & Debris` | calc | Automatic | 1 |  | 17 | 0 | 0 | 0 | — |
| 408 | `Service Class + Service Cat+NDT Remarks+Sub-Contractor` | calc | Automatic | 1201 |  | 0 | 1 | 1 | 0 | — |
| 409 | `Rework Code "PR All"` | calc | Automatic | 28 |  | 0 | 2 | 2 | 0 | — |
| 410 | `Temporary Lines` | calc | Automatic | 1 |  | 0 | 3 | 3 | 0 | `temporary_lines` |
| 411 | `Train SG` | calc | Automatic | 4 |  | 0 | 2 | 2 | 0 | — |
| 412 | `Open_Punch_"X"` | calc | Automatic | 64 |  | 1 | 1 | 1 | 0 | — |
| 413 | `Reinstatement_Date` | calc | Automatic | 594 |  | 0 | 4 | 3 | 0 | — |
| 414 | `Open_Punch_"Y"` | calc | Automatic | 76 |  | 1 | 1 | 1 | 0 | — |
| 415 | `Open_Punch_"Z"` | calc | Automatic | 40 |  | 1 | 1 | 1 | 0 | — |
| 416 | `RT Ratio % For WPS "PR all"` | calc | Automatic | 126 |  | 0 | 0 | 0 | 1 | — |
| 417 | `RT Ratio % STATUS for WPS` | calc | Automatic | 5 |  | 0 | 2 | 2 | 0 | — |
| 418 | `RT Ratio % For Material Type "PR all"` | calc | Automatic | 30 |  | 0 | 0 | 0 | 1 | — |
| 419 | `RT Ratio % STATUS for Material Type` | calc | Automatic | 5 |  | 0 | 2 | 2 | 0 | — |
| 420 | `Status WPQ Welding Process` | calc | Automatic | 17 |  | 0 | 4 | 4 | 0 | — |
| 421 | `Status WPQ Type of Welding Machine` | calc | Automatic | 11 |  | 0 | 6 | 4 | 0 | — |
| 422 | `Bracing` | calc | Automatic | 1 |  | 0 | 2 | 1 | 0 | — |
| 423 | `Task_Status PIP-018-A "VPR"` | calc | Automatic | 1 |  | 0 | 1 | 1 | 0 | — |
| 424 | `Stainless steel` | calc | Automatic | 1 |  | 0 | 3 | 2 | 0 | — |
| 425 | `Exlude RT Films from UT` | calc | Automatic | 1 |  | 4 | 0 | 0 | 0 | — |
