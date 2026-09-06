# The two delivered flange workbooks — full column profile

Produced by `analysis/flange/profile_xlsx.py` (openpyxl read-only, `data_only=True`,
i.e. cached formula values — exactly what Power Query's `Excel.Workbook` sees).
**Read-only: nothing under `sources/` is written.**

## `sources/Flange Progress.xlsx` — 26,100,221 bytes

M: `Excel.Workbook(File.Contents("…\Flange Managment\Flange Progress.xlsx"))`, sheet
`FlangeJointProgress`, `Table.Skip(5)` then `Table.PromoteHeaders`. The `Referential`
sheet is **not** referenced by any Power Query in the pbix.

### sheet `FlangeJointProgress`

* 54 columns · **136,742** non-blank data rows
* read in 17.6s

| # | column | types | non-empty | % | distinct | top values (count) |
|---:|---|---|---:|---:|---:|---|
| 1 | `Test Pack` | str 129,878 | 129,878 | 95.0% | 9,054 | `TBT-21-9401-210-001` 544; `TBT-21-9213-210-001` 463; `TBT-21-8403-210-001` 436; `TBT-21-3120-210-001` 371; `TBT-71-9204-010-001` 362; `TBT-21-9503-210-001` 362; `TBT-23-8403-210-001` 360; `TBT-71-9401-010-001` 357; `TBT-71-9401-020-001` 356; `TBT-31-9405-310-001` 345; `TBT-23-3110-220-004` 341; `TBT-23-3110-220-020` 324; `TBT-71-9213-010-001` 317; `TBT-21-9601-210-001` 297 |
| 2 | `System` | str 130,206 | 130,206 | 95.2% | 460 | `41-9460` 7,500; `21-3110` 6,023; `23-3110` 5,041; `21-3210` 4,651; `41-8750` 4,367; `21-3120` 3,882; `21-3310` 3,757; `23-3310` 2,376; `23-3120` 2,359; `31-8301` 1,989; `71-9204` 1,767; `31-9480` 1,608; `31-9201` 1,367; `71-9401` 1,342 |
| 3 | `SubSystem` | str 130,206 | 130,206 | 95.2% | 909 | `21-3210-210` 2,279; `21-3310-310` 2,079; `23-3310-310` 2,006; `41-8750-310` 1,936; `21-3110-110` 1,923; `41-9460-330` 1,636; `31-9480-310` 1,608; `21-3110-220` 1,514; `71-9204-010` 1,508; `23-3110-220` 1,484; `23-3110-110` 1,482; `21-3110-210` 1,379; `31-9201-110` 1,367; `41-9460-360` 1,352 |
| 4 | `Commissioning Package` | — | 0 | 0.0% | 0 | — |
| 5 | `Iso Number` | str 136,742 | 136,742 | 100.0% | 25,920 | `71150AA-SL6000213R01` 135; `71150AA-SL6000205R01` 121; `71150AA-SL6000005R01` 114; `71150AA-SL6000013R01` 94; `21310A1-VT6131027A01` 91; `71130AB-SL6000205R01` 91; `23330A1-VT7133001A01` 88; `21330A1-VT6133001A01` 85; `71130AD-DW6094103R01` 84; `71130AA-SL6000013R01` 83; `71130AA-SL6000005R01` 82; `71130AA-SL6000213R01` 82; `71130AB-SL6000213R01` 81; `21010AA-DW6194253R01` 80; `32942A1-CH6594021A01` 80 |
| 6 | `Rev No.` | str 136,742 | 136,742 | 100.0% | 156 | `0` 52,651; `0M01` 16,966; `1` 11,461; `0M02` 9,745; `1M01` 4,620; `0M03` 4,591; `0AM01` 3,333; `1M02` 2,863; `0A` 2,477; `0M04` 2,458; `1M03` 2,169; `0AM02` 1,893; `2` 1,868; `0M05` 1,618; `1M04` 1,173 |
| 7 | `Sheet No.` | str 136,742 | 136,742 | 100.0% | 227 | `1` 48,198; `2` 29,185; `3` 17,394; `4` 10,165; `5` 6,740; `6` 4,799; `7` 3,630; `8` 2,701; `9` 2,157; `10` 1,734; `11` 1,391; `12` 1,110; `13` 923; `14` 809; `15` 621 |
| 8 | `BT No.` | str 136,742 | 136,742 | 100.0% | 135 | `BJ1` 26,446; `BJ2` 20,950; `BJ3` 15,785; `BJ4` 10,334; `BJ5` 8,104; `BJ6` 6,633; `BJ7` 5,351; `BJ8` 4,622; `BJ9` 4,050; `BJ10` 3,474; `BJ11` 2,857; `BJ12` 2,489; `BJ13` 2,183; `BJ14` 1,946; `BJ15` 1,738 |
| 9 | `Joint Point` | str 136,742 | 136,742 | 100.0% | 13 | `1` 131,289; `1FR` 5,030; `2` 217; `1FR2` 102; `2FR` 88; `1FR3` 4; `3FR` 4; `1 FRFR` 2; `1 FR` 2; `4FR` 1; `1R` 1; `3` 1; `FR` 1 |
| 10 | `Diam` | str 136,742 | 136,742 | 100.0% | 39 | `1` 32,276; `2` 26,080; `.75` 17,770; `3` 12,362; `4` 9,776; `6` 9,239; `.5` 5,349; `8` 4,800; `1.5` 4,304; `10` 3,977; `12` 2,521; `14` 1,497; `16` 1,352; `20` 1,143; `24` 1,086 |
| 11 | `Rating` | str 136,742 | 136,742 | 100.0% | 6 | `150` 103,859; `300` 14,781; `900` 10,496; `600` 5,242; `1500` 2,362; `3000` 2 |
| 12 | `Bolt Size` | float 132,344, int 4,398 | 136,742 | 100.0% | 41 | `0.62` 51,627; `0.5` 38,868; `0.75` 23,644; `0.88` 11,360; `1` 4,175; `1.12` 3,078; `1.25` 1,481; `1.5` 621; `1.38` 579; `1.62` 286; `1.88` 228; `3.25` 147; `2.5` 121; `2` 119; `1.75` 90 |
| 13 | `Bolt Qty` | str 136,742 | 136,742 | 100.0% | 22 | `4` 88,317; `8` 30,968; `12` 8,666; `16` 3,185; `20` 2,723; `24` 795; `52` 511; `44` 293; `40` 284; `60` 262; `36` 258; `48` 218; `32` 120; `28` 69; `56` 36 |
| 14 | `Bolt Length` | str 136,742 | 136,742 | 100.0% | 138 | `65` 14,747; `90` 14,726; `70` 14,515; `80` 11,672; `85` 10,225; `115` 7,912; `95` 7,836; `100` 7,382; `105` 5,787; `75` 5,534; `110` 5,300; `130` 3,930; `120` 3,847; `150` 2,819; `140` 2,258 |
| 15 | `Bolt Ident` | str 136,742 | 136,742 | 100.0% | 996 | `5AB**190917` 10,049; `5AB**190918` 9,742; `5AB**190955` 8,997; `5AB**190953` 6,600; `5AB**190954` 4,528; `0` 3,951; `5AB**191029` 3,611; `5AB**193059` 3,577; `5AB**193060` 2,596; `5AC**393160` 2,552; `5AB**193098` 2,464; `5AB**190956` 2,192; `5AB**193096` 2,113; `5AC**150480` 2,093; `5AB**191030` 1,936 |
| 16 | `Service Class` | str 136,742 | 136,742 | 100.0% | 166 | `1S1A` 18,582; `1W0WG` 12,123; `1A1A` 10,184; `1W3AX` 7,310; `1J0M` 6,124; `1C0KL` 6,018; `1C4AS` 4,035; `1T3AZ` 3,849; `1W0WC` 3,816; `1C3AS` 3,698; `9C0CE` 2,601; `1P1A` 2,391; `1J0H` 2,354; `9S1Y` 2,113; `3C3AS` 2,018 |
| 17 | `Bolt Desc.` | str 134,691 | 134,691 | 98.5% | 1,723 | `BOLT AND NUT SBN/FULL-THD A19…` 10,028; `BOLT AND NUT SBN/FULL-THD A19…` 9,717; `BOLT AND NUT SBN/FULL-THD A19…` 8,973; `BOLT AND NUT SBN/FULL-THD A19…` 6,565; `BOLT AND NUT SBN/FULL-THD A19…` 4,522; `BOLT AND NUT SBN/FULL-THD A19…` 3,597; `BOLT AND NUT SBN/FULL-THD A19…` 3,545; `BOLT AND NUT SBN/FULL-THD A19…` 2,577; `BOLT AND NUT SBN/FULL-THD A32…` 2,533; `BOLT AND NUT SBN/FULL-THD A19…` 2,450; `BOLT AND NUT SBN/FULL-THD A19…` 2,192; `BOLT AND NUT SBN/FULL-THD A19…` 2,098; `BOLT AND NUT SBN/FULL-THD A32…` 2,094; |
| 18 | `Gasket Desc.` | str 126,963 | 126,963 | 92.8% | 1,830 | `GASKET SPRL-WND W/IOR 316-SS …` 6,447; `GASKET SPRL-WND W/OR 316-SS A…` 4,561; `GASKET SPRL-WND W/IOR 316-SS …` 4,329; `GASKET EXP-GRAPHITE ASME B16.…` 3,593; `GASKET SPRL-WND W/IOR 316-SS …` 3,330; `GASKET SPRL-WND W/IOR 316-SS …` 2,893; `GASKET EXP-GRAPHITE ASME B16.…` 2,612; `GASKET SPRL-WND W/OR 316-SS A…` 2,541; `GASKET EXP-GRAPHITE ASME B16.…` 2,457; `GASKET SPRL-WND W/OR 316-SS A…` 2,090; `GASKET PTFE ASME B16.21 ASME …` 1,712; `GASKET SPRL-WND W/OR 316-SS A…` 1,675; `GASKET EXP-GRAPHITE ASME B16.…` 1,553;  |
| 19 | `Lubricant Type` | str 134,309 | 134,309 | 98.2% | 117 | `Anti-Sieze Comp.` 79,167; `MOLYKOTE 1000` 26,965; `BOSTIK  REGULAR GRADE 2` 6,145; `GRAPHSLIP` 4,898; `BOSTIK` 4,831; `Copper Base` 4,774; `JET-LUBE-550` 3,363; `MOLYSLIP-GRAPHSLIP` 678; `NA` 590; `MOLYKOTTE1000` 494; `MOLYKOTE1000` 490; `MOLYSLIP` 477; `BOSTIK REGULAR GRADE 2` 403; `MOLY SLIP` 199 |
| 20 | `Service Type` | str 136,518 | 136,518 | 99.8% | 142 | `Other Service` 54,337; `LNG/LPG/TOXIC` 24,848; `OTHER SERVICE` 15,605; `other service` 14,525; `LNG-LPG-TOXIC` 4,676; `LNG/LPG/TOXIC-B1` 4,234; `Fresh water service` 3,600; `Other Service.` 3,237; `HHP Steam` 1,899; `LNG/LPG/TOXIC-B12` 1,320; `LNG, LPG & Toxic Service` 1,024; `Other service` 732; `HHP STEAM` 680; `LNG/LPG/TOXIC-B15` 515; `LNG/LPG/TOXIC-B8` 488 |
| 21 | `UT` | int 113,787 | 113,787 | 83.2% | 1 | `0` 113,787 |
| 22 | `Joint Method` | str 136,539 | 136,539 | 99.9% | 6 | `Manual` 82,832; `Torquing` 47,056; `Manual Torquing` 5,986; `Tensionning` 579; `Hydraulic Torquing` 81; `Torquing Critical` 5 |
| 23 | `Jointing Value` | int 135,396 | 135,396 | 99.0% | 399 | `0` 82,999; `59` 9,771; `29` 3,643; `15` 2,840; `25` 2,571; `105` 1,873; `172` 1,449; `10` 1,289; `91` 1,234; `100` 1,000; `95` 965; `40` 914; `80` 872; `135` 626 |
| 24 | `Joint Timing` | str 114,015 | 114,015 | 83.4% | 4 | `Before Pressure Test` 67,932; `Before Precom` 34,250; `Anytime` 8,724; `After Precom` 3,109 |
| 25 | `Cat.` | str 114,015 | 114,015 | 83.4% | 5 | `X` 67,932; `Y` 34,250; `A` 4,555; `B` 4,169; `Z` 3,109 |
| 26 | `Reason` | str 114,015 | 114,015 | 83.4% | 3 | `NA` 75,596; `Test Blind` 34,250; `Broken Flange` 4,169 |
| 27 | `Joint Date` | str 109,984 | 109,984 | 80.4% | 747 | `15-Feb-2026` 842; `09-Feb-2026` 807; `14-Feb-2026` 788; `11-Feb-2026` 711; `08-Feb-2026` 700; `28-Jan-2026` 613; `31-Jan-2026` 576; `25-Dec-2025` 568; `01-Dec-2025` 562; `07-Feb-2026` 540; `01-Feb-2026` 539; `10-Feb-2026` 517; `12-Apr-2025` 516; `26-Jan-2026` 507 |
| 28 | `Report Nbr` | str 109,984 | 109,984 | 80.4% | 30,119 | `TEK-PIP-BT-M-02442` 469; `TEK-PIP-BT-M-05937` 277; `TEK-PIP-BT-M-06305` 262; `NFE1-GAC-SLG-UG-BT-00051` 230; `TEK-PIP-BT-TR-3394` 226; `TEK-PIP-BT-TR-3241` 168; `TEK-PIP--BT-M-06245` 137; `TEK-PIP-BT-M-06206` 128; `TEK-PIP-BT-TR-3519` 124; `TEK-PIP-BT-M-05728` 123; `TEK-PIP-BT-M-06276` 123; `TEK-PIP-BT-M-06449` 112; `TEK-PIP-BT-M-07780` 108; `TEK-PIP-BT-M-01375` 103 |
| 29 | `Jointer` | str 109,984 | 109,984 | 80.4% | 475 | `BT-103` 4,795; `BT-102` 2,884; `TEK-BT-050` 2,507; `BT-071` 2,345; `BT-100` 2,186; `TEK-BT-312` 1,927; `TEK-BT-225` 1,899; `TEK-BT-122` 1,876; `BT-034` 1,854; `TEK-BT-103` 1,786; `BT-091` 1,782; `BT-174` 1,766; `BT-058` 1,706; `TEK-BT-083` 1,687 |
| 30 | `Tag Nbr` | str 109,984 | 109,984 | 80.4% | 32,574 | `NA` 57,704; `N/A` 1,757; `NFE1-MED-BTR-F-00652` 44; `TEK-BT-102` 40; `4619` 34; `NFE1-MED-BTR-F-00065` 32; `01011` 30; `NFE1-MED-BTR-F-00161` 30; `NFE1-MED-BTR-F-00060` 28; `NFE1-MED-BTR-F-00157` 26; `NFE1-MED-BTR-F-00156` 26; `NFE1-MED-BTR-F-00627` 26; `NFE1-MED-BTR-F-00611` 26; `NFE1-MED-BTR-F-00625` 26 |
| 31 | `Tightening Tool Id` | — | 0 | 0.0% | 0 | — |
| 32 | `Control %` | int 136,727 | 136,727 | 100.0% | 5 | `100` 119,065; `20` 13,774; `0` 3,006; `5` 881; `90` 1 |
| 33 | `Flange Batch No` | str 11,864 | 11,864 | 8.7% | 2,530 | `FS153` 20; `FS148` 20; `FS180` 20; `FS1324` 20; `FS182` 20; `FS1338` 20; `FS1335` 20; `FS1337` 20; `FS1325` 20; `FS1339` 20; `FS150` 20; `FS177` 19; `FS2130` 19; `FS162` 19 |
| 34 | `Selected Date` | str 58,668 | 58,668 | 42.9% | 585 | `26-Apr-2026` 523; `30-Aug-2025` 447; `20-Dec-2025` 438; `25-Jun-2026` 433; `22-Jan-2026` 429; `15-Mar-2026` 424; `06-Jul-2026` 420; `07-Dec-2025` 419; `08-Dec-2025` 411; `03-Feb-2026` 404; `11-Jul-2026` 400; `10-Feb-2026` 391; `28-Jun-2026` 376; `22-Feb-2026` 373 |
| 35 | `Issued Date` | — | 0 | 0.0% | 0 | — |
| 36 | `Issue Request No` | — | 0 | 0.0% | 0 | — |
| 37 | `Batch Status` | str 11,864 | 11,864 | 8.7% | 5 | `FLANGETOSELECT` 7,755; `FlangeToSelect` 2,757; `INSPECTED` 1,340; `AWAITINGINSPECTION` 10; `AwaitingInspection` 2 |
| 38 | `Flange Joint Status` | str 107,954 | 107,954 | 78.9% | 6 | `INS` 58,944; `FH` 37,729; `FS` 10,413; `FHS` 856; `?` 9; `FSS` 3 |
| 39 | `Control Inspection Report No` | str 58,467 | 58,467 | 42.8% | 13,554 | `TEK-PIP-BT-M-02442` 469; `TEK-PIP-BT-M-06305` 262; `TEK-PIP-BT-TR-3241` 168; `TEK-PIP--BT-M-06245` 137; `TEK-PIP-BT-M-06276` 124; `TEK-PIP-BT-M-05728` 123; `TEK-PIP-BT-M-01375` 104; `TEK-PIP-BT-M-06435` 101; `TEK-PIP-BT-M-05215` 90; `TEK-PIP-BT-M-06443` 89; `TEK-PIP-BT-TR-FRP-186` 89; `TEK-PIP-BT-TR-492` 88; `TEK-PIP-BT-TR-FRP-991` 85; `TEK-PIP-BT-M-06398` 84 |
| 40 | `Control Inspection Date` | str 58,467 | 58,467 | 42.8% | 680 | `09-Feb-2026` 756; `15-Feb-2026` 668; `11-Feb-2026` 606; `14-Feb-2026` 541; `08-Feb-2026` 517; `10-Feb-2026` 461; `01-Dec-2025` 453; `07-Feb-2026` 431; `04-Feb-2026` 391; `20-Jan-2026` 388; `12-Feb-2026` 373; `08-Apr-2026` 372; `02-Feb-2026` 371; `03-Feb-2026` 357 |
| 41 | `Status - A/R` | str 58,467 | 58,467 | 42.8% | 2 | `A` 58,453; `R` 14 |
| 42 | `Client Requested` | str 661 | 661 | 0.5% | 1 | `Y` 661 |
| 43 | `Reason for De-Tightening` | str 4,765 | 4,765 | 3.5% | 7 | `PRECOM BLOWING` 2,752; `Timing AF/BF-TEST or PRECOM` 1,456; `FLANGE LEAKAGE` 267; `PRECOM FLUSHING` 219; `SPECTACLE BLIND ROTATION` 36; `TEMPORARY SPOOL/HOSE` 28; `TEMPORARY GSKT` 7 |
| 44 | `User requested for De-Tightening` | str 4,765 | 4,765 | 3.5% | 21 | `mirza.danish` 1,817; `Sathish.qc` 943; `EasyPiping` 586; `rnadimuthu` 306; `PMagpantay` 218; `NShahzad` 202; `lonathan` 188; `rahulkg.qc` 188; `karumugam` 113; `Manavalan.r` 93; `s.sadique` 44; `ANRiaz` 40; `r.ramachandran2` 12; `mirza.khurram` 4 |
| 45 | `De-Tightening Requested Date` | str 4,765 | 4,765 | 3.5% | 293 | `29-Mar-2026` 118; `12-Mar-2026` 113; `25-Feb-2026` 105; `02-Feb-2026` 98; `23-Feb-2026` 98; `01-Jul-2026` 82; `02-Jul-2026` 78; `05-Feb-2026` 71; `20-Jan-2026` 70; `29-Jul-2026` 65; `29-Jun-2026` 63; `30-Mar-2026` 63; `25-Jun-2026` 61; `27-Feb-2026` 60 |
| 46 | `Hold Status` | str 130,435 | 130,435 | 95.4% | 2 | `No` 130,434; `Yes` 1 |
| 47 | `Hold Date` | str 1 | 1 | 0.0% | 1 | `19-Feb-2025` 1 |
| 48 | `Hold Comments` | — | 0 | 0.0% | 0 | — |
| 49 | `Flange Subcontractor` | str 136,742 | 136,742 | 100.0% | 5 | `TEKFEN` 67,083; `GAC` 57,040; `MEDGULF` 12,617; `ACCIONA` 1; `TBD` 1 |
| 50 | `WITNESSED BY` | str 96,518 | 96,518 | 70.6% | 80 | `VISHNU DAS` 21,475; `LAL MOHAMMAD` 19,582; `NOMAN SHAHZAD` 7,759; `N RAMKUMAR` 7,522; `IBRAHIM USTUN` 6,737; `ANIKET` 5,636; `ANJAM RIAZ` 5,331; `ANTONY` 4,642; `NADIR KHAN` 3,818; `SATHISH KUMAR` 3,076; `MOHD RIYAZUDDIN` 2,819; `ABDUL KHALID` 2,507; `NIDHEESH` 1,308; `JOMY JAMES` 648 |
| 51 | `ACC/REJ` | str 96,418 | 96,418 | 70.5% | 18 | `ACC` 96,295; `NIDHEESH` 76; `ANJAM RIAZ` 10; `AC` 8; `ANIKET` 8; `CC` 4; `NIDEESH` 3; `acc` 3; `VISHNU DAS` 2; `AACC` 1; `AJITH` 1; `AA` 1; `ACA` 1; `ACC.` 1 |
| 52 | `REMARKS` | str 3,693 | 3,693 | 2.7% | 2,328 | `ACC` 113; `B-ITR (PRV)` 55; `PSV/PRV-B-ITR` 23; `A-ITR (MECHANICAL)` 16; `PL-111336` 16; `PSV-PRV (B-ITR)` 14; `PL-112947` 13; `PL-112958` 13; `PSV/PRV/B-ITR` 12; `PL-109815` 12; `PL-109833` 12; `PL-115811` 10; `PL-134081` 9; `PL-110737` 7 |
| 53 | `BTC01` | — | 0 | 0.0% | 0 | — |
| 54 | `BT24` | — | 0 | 0.0% | 0 | — |

### sheet `Referential`

* 6 columns · **644** non-blank data rows
* not used by any M query — profiled for completeness

| # | column | types | non-empty | % | distinct | top values (count) |
|---:|---|---|---:|---:|---:|---|
| 1 | `40` | int 6 | 6 | 0.9% | 6 | `50` 1; `60` 1; `70` 1; `80` 1; `90` 1; `100` 1 |
| 2 | `BT-069` | str 644 | 644 | 100.0% | 644 | `BT-070` 1; `BT-098` 1; `BT-M-013` 1; `TEK-BT-059` 1; `TEK-BT-067` 1; `TEK-BT-068` 1; `TEK-BT-070` 1; `TEK-BT-071` 1; `TEK-BT-072` 1; `TEK-BT-073` 1; `BT-M-001` 1; `BT-008` 1; `TKF-001` 1; `TEK-BT-001` 1; `TEK-BT-002` 1 |
| 3 | `Column3` | — | 0 | 0.0% | 0 | — |
| 4 | `Column4` | — | 0 | 0.0% | 0 | — |
| 5 | `Column5` | — | 0 | 0.0% | 0 | — |
| 6 | `TEMPORARY SPOOL/HOSE` | str 1 | 1 | 0.2% | 1 | `Timing AF/BF-TEST or PRECOM` 1 |

## `sources/ovAssets_1619.xlsx` — 29,070,219 bytes

M: `Excel.Workbook(File.Contents("…\Flange Managment\ovAssets_1619.xlsx"))`, sheet
`Exported from SC`, headers on row 1, then ~120 rename/replace steps that re-shape it
into the `Flange Progress` column vocabulary and hard-code `Flange Subcontractor = "CCC"`.

### sheet `Exported from SC`

* 46 columns · **226,504** non-blank data rows · pbix table `Flange ovAssets_1619` = 226,504 rows
* read in 19.6s

| # | column | types | non-empty | % | distinct | top values (count) |
|---:|---|---|---:|---:|---:|---|
| 1 | `FlangeJointName` | str 226,504 | 226,504 | 100.0% | 226,504 | `11010P1-CC6292103-J01` 1; `11010P1-CV6206101-J01` 1; `11010P1-CV6206103-J02` 1; `11010P1-CV6206109-J05` 1; `11010P1-CV6208082A-J01` 1; `11010P1-CV6210047A-J05` 1; `11010P1-CW6294101-J01` 1; `11010P1-BD6287101-J01` 1; `11010P1-CV6205301-J03` 1; `11010P1-CV6205301-J05` 1; `11010P1-CV6206101-J03` 1; `11010P1-CV6206101-J04` 1; `11010P1-CV6206101-J06` 1; `11010P1-CV6206102-J01` 1; `11010P1-CV6205301-J01` 1 |
| 2 | `WeldAreaName` | str 226,504 | 226,504 | 100.0% | 468 | `11090A2` 5,765; `12090A2` 5,679; `13090A2` 5,645; `14090A2` 5,643; `11020A1` 5,276; `12020A1` 5,192; `13020A1` 5,139; `14020A1` 5,139; `11070A1` 4,432; `12070A1` 4,251; `13070A1` 4,223; `14070A1` 4,220; `11030A1` 3,385; `12030A1` 3,329; `13030A1` 3,289 |
| 3 | `PipingIsometricNum - Field026 (Custom)` | str 226,504 | 226,504 | 100.0% | 46,782 | `11010Q6-AG6202001` 120; `12010Q6-AG6302001` 120; `13010Q6-AG7202001` 120; `14010Q6-AG7302001` 120; `11090A2-SL6209009` 117; `12090A2-SL6309009` 117; `13090A2-SL7209009` 117; `14090A2-SL7309009` 117; `11010S6-SV6209074` 116; `12010S6-SV6309074` 115; `11090A2-VT6209045` 104; `12090A2-VT6309045` 103; `13090A2-VT7209045` 103; `14090A2-VT7309045` 103; `13010S6-SV7209074` 102 |
| 4 | `Line No. - Field025 (Custom)` | str 225,968 | 225,968 | 99.8% | 28,513 | `SL6209055-6"(1T3AZ)-ZF(138)(2…` 648; `SW6294101-6"(1W0WG)-N` 554; `DW6294101-4"(1W0WG)-N` 493; `AG6202001-10"(1D0JL)-N` 480; `DW6294301-3"(1W0WG)-5N(35)(25)` 269; `DW6294305-3"(1W0WG)-5N(35)(25)` 256; `SA6295101-1"(1A1A)-N` 248; `AG6202002-12"(1D0JL)-N` 240; `LS6292102-2"(1S1A)-1(150)(25)` 236; `SW6294101-1"(1W0WG)-N` 233; `N6296101-1"(1A1A)-N` 220; `LS6292101-2"(1S1A)-1(160)(40)` 213; `DW6294302-3"(1W0WG)-5N(35)(25)` 208; `AG6209046-10"(1B1JL)-N` 204 |
| 5 | `Test Pack No - Field029 (Custom)` | str 226,495 | 226,495 | 100.0% | 17,272 | `TBD-14-9601-010-503` 2,205; `TBD-14-9503-010-501` 1,838; `TBD-11-9213-010-503` 1,428; `TBD-14-9213-010-503` 1,394; `TBD-12-9213-010-503` 1,393; `TBD-12-9204-010-522` 1,361; `TBD-14-9204-010-522` 1,354; `TBD-13-9213-010-503` 1,349; `TBD-11-9204-010-522` 1,340; `TBD-13-9204-010-522` 1,335; `TBD-14-9401-010-502` 1,267; `TBD-11-8401-010-501` 999; `TBD-12-8401-010-501` 906; `TBD-14-8401-010-501` 866; `TBD-13-8401-010-501` 838 |
| 6 | `Category for final tightening - Field030 (Custom)` | str 170,618 | 170,618 | 75.3% | 4 | `X` 87,948; `Y` 65,460; `Z` 17,052; `A` 158 |
| 7 | `Process Plant` | str 226,493 | 226,493 | 100.0% | 5 | `HA1 - Handover Area 1 (PHA-01…` 58,056; `HA2 - Handover Area 2 (PHA-06…` 56,388; `HA3 - Handover Area 3 (PHA-08…` 56,074; `HA4 - Handover Area 4 (PHA-12…` 55,920; `HA-NA - Not Applicable` 55 |
| 8 | `Process Area` | str 226,493 | 226,493 | 100.0% | 12 | `PHA-07 - Train 9` 56,370; `PHA-11 - Train 10` 55,995; `PHA-13 - Train 11, Inlet Spar…` 55,902; `PHA-05b - Train 8 - Cold sect…` 36,877; `PHA-05a - Train 8 - Hot secti…` 18,725; `PHA-05c - Train 8 - N2 refrig…` 2,204; `PHA-02 - Train 8 Utilities` 250; `PHA-09 - Train 10&11 Offsite,…` 66; `PHA-NA - Not Applicable` 55; `PHA-06 - Train 9 Utilities` 18; `PHA-12 - Train 11 Utilities` 18; `PHA-08 - Train 10 Utilities` 13 |
| 9 | `System` | str 226,493 | 226,493 | 100.0% | 474 | `11-0220a - Process Train8 Aci…` 4,798; `12-0220 - Process Train9 Acid…` 4,701; `13-0220 - Process Train10 Aci…` 4,640; `14-0220 - Process Train11 Aci…` 4,639; `11-0610b - Process Train8 C3 …` 3,239; `11-0410b - Process Train8 NGL…` 3,168; `12-0610 - Process Train9 C3 R…` 3,095; `12-0410 - Process Train9 NGL …` 3,073; `13-0410 - Process Train10 NGL…` 3,070; `13-0610 - Process Train10 C3 …` 3,069; `14-0410 - Process Train11 NGL…` 3,064; `14-0610 - Process Train11 C3 …` 3,063; `11-0340a - Process Train8 Reg…` 3,000;  |
| 10 | `Subsystem` | str 226,493 | 226,493 | 100.0% | 904 | `11-0410-010 - Process Train8 …` 2,989; `12-0410-010 - Process Train9 …` 2,894; `13-0410-010 - Process Train10…` 2,892; `14-0410-010 - Process Train11…` 2,886; `11-0930-010 - Process Train8 …` 2,685; `13-0930-010 - Process Train10…` 2,634; `14-0930-010 - Process Train11…` 2,634; `12-0930-010 - Process Train9 …` 2,630; `11-0220-020 - Process Train8 …` 2,509; `12-0220-020 - Process Train9 …` 2,454; `13-0220-020 - Process Train10…` 2,414; `14-0220-020 - Process Train11…` 2,414; `11-9601-010 - Process Train8 …` 2,217;  |
| 11 | `Spec` | str 225,965 | 225,965 | 99.8% | 119 | `1S1A` 27,385; `1A1A` 18,948; `1W0WG` 10,601; `1W3AX` 8,227; `1B6AS` 7,274; `3R1B2` 6,792; `6R0JL6` 6,399; `1W0WA` 6,067; `6R1B` 5,993; `1P1A` 5,954; `1R1B` 5,899; `6R0JL` 5,353; `3R0JL` 4,725; `3R1B3` 4,715; `6R0JL1` 4,637 |
| 12 | `Material ID Code` | str 225,567 | 225,567 | 99.6% | 36 | `A105N` 141,780; `A182-F304/F304L` 37,765; `A350-LF2 CL.1` 31,759; `A182-F316/F316L` 5,913; `ASTM A105` 2,432; `B171-C70600` 1,419; `ASTM A350-LF2` 878; `A182-F11 CL.2` 868; `ASTM A182-F304/F304L` 845; `ASTM B171-C70600` 583; `A395-65-45-15` 198; `A216-WCB` 134; `ASTM A216-WCB` 129; `A350-LF2` 123 |
| 13 | `Joint Size` | str 225,972 | 225,972 | 99.8% | 46 | `1` 46,824; `2` 46,144; `0.75` 40,377; `3` 18,001; `6` 13,444; `4` 10,691; `1.5` 8,886; `0.5` 7,116; `8` 6,955; `10` 5,110; `12` 4,329; `20` 2,872; `16` 2,690; `14` 2,508; `24` 2,016 |
| 14 | `Gasket Type` | str 225,871 | 225,871 | 99.7% | 10 | `316-SS` 172,729; `EXP-GRAPHITE` 38,312; `PTFE` 14,715; `PTFE SOFT-DEFORMABLE` 98; `SW 316/GRAPHITE - NO IR/OR` 6; `316-ss` 4; `PTFE SOFT DEFORMABLE` 4; `0` 1; `PTE` 1; `EXP-GRPAHITE` 1 |
| 15 | `Gasket Rating` | str 225,905 | 225,905 | 99.7% | 7 | `150` 126,053; `300` 51,331; `600` 41,620; `1500` 4,986; `900` 1,839; `2500` 72; `350` 4 |
| 16 | `Stud Number` | str 225,962 | 225,962 | 99.8% | 24 | `4` 138,637; `8` 51,812; `12` 14,669; `20` 6,098; `16` 5,311; `24` 3,985; `28` 1,496; `36` 953; `44` 781; `40` 719; `32` 646; `48` 338; `60` 177; `52` 111 |
| 17 | `Stud Diameter` | str 225,962 | 225,962 | 99.8% | 46 | `0.625` 99,439; `0.5` 59,494; `0.75` 28,212; `0.875` 12,763; `1` 6,080; `1.125` 5,082; `1.25` 4,678; `1.625` 2,189; `1.49999999999999` 1,084; `15.875` 1,064; `2.25` 1,054; `1.375` 900; `1.875` 806; `19.05` 459 |
| 18 | `Stud Length` | str 225,988 | 225,988 | 99.8% | 166 | `0.065` 30,034; `0.0899999999999999` 24,669; `0.07` 20,935; `0.075` 17,004; `0.08` 14,212; `0.11` 13,887; `0.095` 13,634; `0.0849999999999999` 12,644; `0.09` 8,319; `0.105` 6,285; `0.12` 5,050; `0.085` 4,440; `0.13` 4,382; `0.1` 4,361; `0.14` 3,134 |
| 19 | `Tightening Method` | str 225,933 | 225,933 | 99.7% | 4 | `Manual` 165,080; `Torqueing` 58,431; `Tensioning` 2,392; `Torquing` 30 |
| 20 | `Torque Value` | str 66,664 | 66,664 | 29.4% | 165 | `79` 9,370; `103` 6,230; `39` 5,059; `0` 5,024; `92` 3,894; `180` 2,589; `140` 2,535; `50` 2,135; `73` 1,965; `930` 1,473; `340` 1,441; `230` 1,278; `170` 1,268; `80` 1,202 |
| 21 | `Torque EU` | str 226,504 | 226,504 | 100.0% | 1 | `N-m` 226,504 |
| 22 | `Report Number - Field031 (Custom)` | str 92,944 | 92,944 | 41.0% | 45,736 | `BT011235` 52; `BT01083` 48; `BT01283` 48; `BT01548` 48; `BT009471` 42; `BT01585` 36; `BT012258` 36; `BT010425` 33; `BT022289` 31; `BT01119` 29; `BT01092` 29; `BT009620` 29; `BT011043` 28; `BT022966` 27 |
| 23 | `Tightening Date - Field027 (Custom)` | str 93,089 | 93,089 | 41.1% | 975 | `2025/10/28` 491; `2025/11/22` 452; `2025/10/01` 430; `2025/11/17` 425; `2025/11/20` 424; `2025/11/01` 416; `2025/04/01` 415; `2025/10/14` 413; `2025/11/24` 395; `2026/05/24` 391; `2025/09/01` 380; `2025/10/16` 377; `2025/11/08` 376; `2025/11/11` 375 |
| 24 | `Serial No of Field Tag - Field023 (Custom)` | str 22,841 | 22,841 | 10.1% | 22,250 | `T24559` 10; `T24558` 9; `T25448` 6; `T24555` 6; `T25449` 5; `T24557` 5; `T26393` 4; `T25446` 4; `T32452` 4; `T32451` 4; `T33743` 4; `T33763` 4; `T33744` 4; `T24556` 4 |
| 25 | `Verified Date - Field024 (Custom)` | str 2,139 | 2,139 | 0.9% | 76 | `2025/05/18` 308; `2025/06/30` 186; `2025/06/01` 178; `2025/06/19` 147; `2025/04/26` 141; `2025/04/12` 125; `2025/06/26` 116; `2025/05/07` 110; `2025/05/19` 55; `2025/03/22` 54; `2025/04/19` 51; `2025/03/25` 50; `2025/07/01` 43; `2025/06/08` 42 |
| 26 | `Re-Tightening Report Number - Field032 (Custom)` | — | 0 | 0.0% | 0 | — |
| 27 | `Re-Tightening Date - Field028 (Custom)` | — | 0 | 0.0% | 0 | — |
| 28 | `Flange Repair Record - Field032 (Custom)` | — | 0 | 0.0% | 0 | — |
| 29 | `Crew ID - Field034 (Custom)` | str 88,561 | 88,561 | 39.1% | 431 | `BT-0217` 5,291; `BT-0365` 4,412; `BT-0370` 3,552; `BT-0215` 3,187; `BT-0199` 2,971; `BT-0511` 2,379; `BT-400` 2,344; `BT-0431` 2,185; `BT-0552` 1,952; `BT-0386` 1,711; `BT-0287` 1,663; `BT-0438` 1,585; `BT-0401` 1,516; `BT-0402` 1,448 |
| 30 | `Stud Material` | str 1,852 | 1,852 | 0.8% | 3 | `A105N` 1,132; `A350-LF2 CL.1` 564; `A182-F304/F304L` 156 |
| 31 | `Nut Material` | — | 0 | 0.0% | 0 | — |
| 32 | `Parent Asset` | — | 0 | 0.0% | 0 | — |
| 33 | `Record Modified By` | str 226,504 | 226,504 | 100.0% | 7 | `Khan, Fahad Ahmed` 163,275; `Budianto, Setyo` 61,019; `Gentizon, Arlene` 1,120; `Xavier, Thaddeus` 1,035; `Adrales, John Robert` 24; `Perez, John Ysmael` 18; `Clerigo, Virgilio` 13 |
| 34 | `Record Modified Date` | date 226,504 | 226,504 | 100.0% | 57 | `2024-09-01` 163,275; `2026-07-08` 38,902; `2026-07-07` 18,654; `2024-10-27` 2,600; `2024-09-18` 1,156; `2026-07-26` 427; `2025-07-19` 284; `2025-07-13` 117; `2024-11-06` 74; `2026-08-02` 68; `2025-10-01` 55; `2025-11-04` 54; `2025-12-15` 50; `2026-07-30` 48; `2025-09-02` 48 |
| 35 | `FL - Torque Value` | str 66,521 | 66,521 | 29.4% | 163 | `79` 9,358; `103` 6,230; `39` 5,048; `0` 5,021; `92` 3,889; `180` 2,589; `140` 2,535; `50` 2,127; `73` 1,957; `930` 1,470; `340` 1,436; `230` 1,276; `170` 1,268; `80` 1,195 |
| 36 | `FL - Tightening Method` | str 224,701 | 224,701 | 99.2% | 3 | `Manual` 164,027; `Torqueing` 58,282; `Tensioning` 2,392 |
| 37 | `Construction Responsible Company` | — | 0 | 0.0% | 0 | — |
| 38 | `Commissioning Responsible Company` | — | 0 | 0.0% | 0 | — |
| 39 | `PCC Serial No of Field Tag - Field038 (Custom)` | str 1,954 | 1,954 | 0.9% | 1,938 | `10942` 2; `15831` 2; `01787` 2; `10806` 2; `41209` 2; `30180` 2; `30181` 2; `10807` 2; `14576` 2; `32448` 2; `41370` 2; `30231` 2; `15825` 2; `10442` 2 |
| 40 | `PCC Tightening Date - Field039 (Custom)` | str 6,820 | 6,820 | 3.0% | 354 | `2026/07/14` 157; `2026/8/20` 132; `2026/07/29` 111; `2026/07/30` 107; `2026/08/11` 78; `2026/08/03` 78; `2026/07/27` 76; `2026/08/12` 74; `2026/08/19` 73; `2026/05/19` 70; `2026/06/03` 68; `2026/07/18` 68; `2026/04/11` 68; `2026/07/28` 68 |
| 41 | `PCC Report Number - Field040 (Custom)` | str 6,820 | 6,820 | 3.0% | 4,690 | `BT01447-PCC` 13; `BT01362-PCC` 12; `BT01364-PCC` 11; `BT01849-PCC` 11; `BT01756-PCC` 11; `BT01995-PCC` 10; `BTOR01623-PCC` 9; `BT00100-PCC` 9; `BT01359-PCC` 9; `BT01648-PCC` 9; `BT01647-PCC` 9; `BT01282-PCC` 8; `BT01064-PCC` 8; `BTOR01335-PCC` 8 |
| 42 | `PCC Verified Date - Field041 (Custom)` | str 6,820 | 6,820 | 3.0% | 355 | `2026/07/14` 171; `2026/8/20` 120; `2026/07/29` 112; `2026/07/30` 107; `2026/08/11` 89; `2026/08/03` 78; `2026/08/12` 77; `2026/07/27` 76; `2026/07/16` 71; `2026/08/19` 71; `2026/05/31` 70; `2026/06/03` 68; `2026/07/18` 68; `2026/07/28` 67 |
| 43 | `PCC Re-Tightening Date - Field042 (Custom)` | str 234 | 234 | 0.1% | 62 | `2026/07/05` 24; `2026/06/14` 18; `2026/08/15` 13; `2026/07/07` 13; `2026/08/01` 10; `2026/06/13` 10; `2026/06/16` 8; `2026/06/22` 8; `2026/07/04` 6; `2026/07/14` 6; `2026/07/16` 6; `2026/08/11` 5; `2026/07/30` 5; `2026/06/17` 5 |
| 44 | `PCC Re-Tightening Report Number - Field043 (Custom)` | str 234 | 234 | 0.1% | 197 | `BT02116-PCC` 3; `BT02275-PCC` 2; `BT03222-PCC` 2; `HBT00054-PCC` 2; `BT02842-PCC` 2; `BT01725-PCC` 2; `BT01726-PCC` 2; `BT01724-PCC` 2; `BT01721-PCC` 2; `BTOR01506-PCC` 2; `BTOR01510-PCC` 2; `BTOR01603-PCC` 2; `BT03149-PCC` 2; `BT02003-PCC` 2 |
| 45 | `PCC Crew ID - Field044 (Custom)` | str 1,967 | 1,967 | 0.9% | 136 | `BT-663` 132; `BT-617` 132; `BT-675` 104; `BT-510` 86; `BT-673` 85; `BT-674` 83; `BT-633` 75; `BT-672` 72; `BT-504` 64; `BT-607` 59; `BT-752` 57; `BT-781` 54; `BT-671` 51; `BT-782` 51 |
| 46 | `PCC Remarks - Field045 (Custom)` | str 2,785 | 2,785 | 1.2% | 4 | `Disturb by PCC` 2,664; `Flange Leakage` 119; `62RO030650 re-installed after…` 1; `Disturb by Const'n` 1 |

## Row-count reconciliation against the pbix

| step | rows |
|---|---:|
| `FlangeJointProgress` non-blank data rows (after `Table.Skip(5)`) | 136,742 |
| … after `Iso Number ∉ {0, 1M03}`, `Flange Subcontractor ≠ ACCIONA`, `Joint Date ≠ 2026-11-20` | 136,741 |
| `Exported from SC` non-blank data rows | 226,504 |
| … kept | 226,504 |
| **combined = pbix `Flange Progress`** | **363,245** |
| pbix stores | 363,245 |
| delta | +0 |

`Flange ovAssets_1619` on its own: 226,504 rows here vs 226,504 in the pbix (+0).

## Do the two workbooks join?

They are **appended, not joined** (`Table.Combine`). The candidate key on both sides is
`Joint ID` — built as `[Iso Number] & "-" & [BT No.]` in `Flange Progress`, and
read straight from `FlangeJointName` in `ovAssets_1619`.

| set | distinct Joint IDs |
|---|---:|
| `Flange Progress` sheet | 131,283 |
| `ovAssets_1619` sheet | 226,504 |
| **intersection** | **0** |
| union (= pbix `Total Flanges ID`) | 357,787 |

Coverage: 0.00% of the `Flange Progress` keys and 0.00% of the
`ovAssets_1619` keys appear on the other side.

## The mockup's own numbers, recomputed from the delivered data

Measure definitions are the pbix DAX verbatim (see `analysis/flange/pbix-flange.md`).
`HA` is the DAX calc column *without* its `HA l0_abs_guide` fallback (that CSV is absent).

### Overall

| metric | computed | mockup `rawData` | delta |
|---|---:|---:|---:|
| total | 357,787 | 358,342 | -555 |
| constn | 187,756 | 122,867 | +64,889 |
| pcc | 16,880 | 2,276 | +14,604 |
| inspected | 197,825 | 124,188 | +73,637 |
| leaked | 386 | 44 | +342 |
| inspected % | 55.29% | 34.66% | — |

### By sub-contractor

| subcontractor | total | const-n | PCC | inspected | % | leaked | mockup total | mockup inspected |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CCC | 226,504 | 88,794 | 6,820 | 92,934 | 41.03% | 119 | 227,605 | 59,444 |
| TEKFEN | 64,359 | 57,121 | 4,529 | 59,398 | 92.29% | 63 | 64,626 | 33,017 |
| GAC | 54,306 | 32,581 | 5,469 | 36,171 | 66.61% | 204 | 53,550 | 25,022 |
| MEDGULF | 12,617 | 9,260 | 62 | 9,322 | 73.88% | 0 | 12,561 | 6,705 |
| TBD | 1 | 0 | 0 | 0 | 0.00% | 0 | — | — |

### By HA

| HA | total | const-n | PCC | inspected | % | leaked | remains |
|---|---:|---:|---:|---:|---:|---:|---:|
| (blank) | 6,593 | 2,168 | 25 | 2,190 | 33.22% | 0 | 4,403 |
| HA1 | 145,839 | 130,575 | 15,808 | 140,181 | 96.12% | 366 | 5,887 |
| HA2 | 60,237 | 33,774 | 649 | 34,096 | 56.60% | 12 | 26,224 |
| HA3 | 85,747 | 19,771 | 354 | 19,888 | 23.19% | 8 | 65,909 |
| HA4 | 59,371 | 1,468 | 44 | 1,470 | 2.48% | 0 | 57,903 |

### HA cross-check: DAX `MID([System],2,1)` vs `ovAssets_1619[Process Plant]`

`ovAssets_1619` carries the handover area **verbatim** in `Process Plant`
(`HA1 - Handover Area 1 (PHA-01, 02, 03, 04, 05)`), a column the pbix never uses for HA.

* rows where the DAX rule and `Process Plant` agree: **226,438** of 226,504
* rows where they disagree: **0**
* rows the DAX rule leaves blank but `Process Plant` resolves: **0**

### By joint method  (the `Project Flange Inspected` donut)

| method | total | inspected | share of inspected |
|---|---:|---:|---:|
| Manual | 249,155 | 138,177 | 69.85% |
| Torquing | 103,713 | 57,397 | 29.01% |
| TBN | 2,006 | 1,128 | 0.57% |
| Tensioning | 2,913 | 1,123 | 0.57% |

### By source workbook

| source | total | const-n | PCC | inspected | leaked | remains |
|---|---:|---:|---:|---:|---:|---:|
| `Flange Progress.xlsx` / FlangeJointProgress | 131,283 | 98,962 | 10,060 | 104,891 | 267 | 26,756 |
| `ovAssets_1619.xlsx` / Exported from SC (all CCC) | 226,504 | 88,794 | 6,820 | 92,934 | 119 | 133,570 |

### `Reason for De-Tightening` — top 15 non-blank values

| value | rows |
|---|---:|
| `PRECOM BLOWING` | 2,752 |
| `DISTURB BY PCC` | 2,664 |
| `TIMING AF/BF-TEST OR PRECOM` | 1,456 |
| `FLANGE LEAKAGE` | 386 |
| `PRECOM FLUSHING` | 219 |
| `SPECTACLE BLIND ROTATION` | 36 |
| `TEMPORARY SPOOL/HOSE` | 28 |
| `TEMPORARY GSKT` | 7 |
| `62RO030650 RE-INSTALLED AFTER DEGREASING` | 1 |
| `DISTURB BY CONST'N` | 1 |

### Monthly inspection  (`Total Flanges ID Jointed` by `Joint Date` month)

| month | jointed | | month | jointed |
|---|---:|---|---|---:|
| 2022-09 | 11 | | 2024-10 | 1,005 |
| 2022-10 | 18 | | 2024-11 | 1,465 |
| 2022-11 | 15 | | 2024-12 | 2,082 |
| 2022-12 | 10 | | 2025-01 | 3,054 |
| 2023-01 | 14 | | 2025-02 | 2,998 |
| 2023-02 | 17 | | 2025-03 | 5,909 |
| 2023-03 | 46 | | 2025-04 | 9,184 |
| 2023-04 | 51 | | 2025-05 | 8,185 |
| 2023-05 | 57 | | 2025-06 | 8,689 |
| 2023-06 | 41 | | 2025-07 | 9,390 |
| 2023-07 | 20 | | 2025-08 | 9,353 |
| 2023-08 | 24 | | 2025-09 | 10,821 |
| 2023-09 | 52 | | 2025-10 | 14,423 |
| 2023-10 | 53 | | 2025-11 | 15,410 |
| 2023-11 | 43 | | 2025-12 | 14,351 |
| 2023-12 | 37 | | 2026-01 | 13,367 |
| 2024-01 | 39 | | 2026-02 | 14,679 |
| 2024-02 | 45 | | 2026-03 | 6,441 |
| 2024-03 | 84 | | 2026-04 | 12,371 |
| 2024-04 | 40 | | 2026-05 | 11,516 |
| 2024-05 | 105 | | 2026-06 | 9,600 |
| 2024-06 | 184 | | 2026-07 | 9,832 |
| 2024-07 | 402 | | 2026-08 | 6,446 |
| 2024-08 | 247 | | 2027-02 | 1 |
| 2024-09 | 691 | |  |  |

### Grain: rows per Joint ID

`Flange Progress.xlsx` contributes 136,741 rows for 131,283 distinct Joint IDs
(**5,458 repeat rows** — the same flange re-jointed; see `Joint Point` `1FR`/`1FR2`…).
`ovAssets_1619.xlsx` contributes 226,504 rows for 226,504 distinct Joint IDs
(0 repeats). **Every mockup number is a DISTINCTCOUNT of `Joint ID`, never a row count.**

### Monthly inspection by source workbook

| month | `Flange Progress` | `ovAssets_1619` | total | mockup `rawData.monthly.All` |
|---|---:|---:|---:|---:|
| 2025-06 | 4,037 | 4,652 | 8,689 | — |
| 2025-07 | 4,675 | 4,715 | 9,390 | — |
| 2025-08 | 4,533 | 4,820 | 9,353 | 9,344 |
| 2025-09 | 4,894 | 5,927 | 10,821 | 10,044 |
| 2025-10 | 6,855 | 7,568 | 14,423 | 16,764 |
| 2025-11 | 7,745 | 7,665 | 15,410 | 15,911 |
| 2025-12 | 9,476 | 4,875 | 14,351 | 13,336 |
| 2026-01 | 9,122 | 4,245 | 13,367 | 4,747 |
| 2026-02 | 10,807 | 3,872 | 14,679 | — |
| 2026-03 | 3,913 | 2,528 | 6,441 | — |
| 2026-04 | 7,381 | 4,990 | 12,371 | — |
| 2026-05 | 5,145 | 6,371 | 11,516 | — |
| 2026-06 | 4,087 | 5,513 | 9,600 | — |
| 2026-07 | 4,031 | 5,801 | 9,832 | — |
| 2026-08 | 2,200 | 4,246 | 6,446 | — |
| 2027-02 | 1 | 0 | 1 | — |

_Generated in 40.8s. Machine-readable copy: `analysis/flange/metrics.json`._
