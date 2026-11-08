# Nova Browser — təhvil və yoxlama hesabatı

**Tarix:** 8 noyabr 2026

## Nəticə

Nova real saytları Chromium webview-də açan Electron brauzer layihəsidir. Bu təhvil **mənbə kodu və build təlimatıdır**; hazır, imzalanmış və notarizasiya olunmuş macOS buraxılışı deyil.

## Hazırlanan imkanlar

Mənbədə URL/axtarış naviqasiyası, tablar, vertical tabs, tab qrupları və workspaces, split view, bookmarks və tarixçə, download paneli, private pəncərə, sadə reader, screenshot saxlama axını, AI/translation prompt-u, Electron `safeStorage` ilə şifrələnən parol saxlama API-si, unpacked extension manager, Ghostery filter engine, məxfilik/icazə nəzarəti, session restore və crash recovery mexanizmləri mövcuddur.

`results/electron-smoke.json` faylında aşağıdakılar faktiki **PASS** göstərilib: Electron UI/CSP və local Chromium səhifəsi; Google, YouTube, Google hesabına giriş səhifəsi, Instagram, Facebook və React; bookmark və tarixçə; tab, split, vertical tabs, workspace və group əməliyyatları; local download; reader mətn çıxarışı; private pəncərə və persistent tarixçədən təcrid; Linux/Xvfb-də MP4 playback; təmiz restart-dan sonra session restore; əsas Electron process-i `SIGKILL` etdikdən sonra bərpa; unpacked extension-ın Electron API-si ilə yüklənməsi.

Bu nəticələr tətbiqin gündəlik istifadəyə tam hazır olduğunu və ya təhlükəsizlik auditindən keçdiyini sübut etmir. Ad/tracker mühərrikinin işə düşməsi yoxlanıb; real tracker sorğularının bloklanması ayrıca ölçülməyib. Google Accounts yoxlaması yalnız hesab giriş səhifəsidir, Gmail inbox-una giriş yoxlanmayıb.

## `NOT RUN` və məhdudiyyətlər

- M1/ARM64 native build, həqiqi `.app`/`.dmg`, macOS Retina/GPU/hardware decode, audio çıxışı, bildirişlər, Apple Keychain, Gatekeeper, code signing və notarization.
- AI/translation provider-ə sorğu göndərmək və API key saxlamaq. Linux mühitində Electron `basic_text` backend-i qaytardığı üçün məxfi məlumatların saxlanması qəsdən rədd edilib.
- Native screenshot save dialog, OS Picture-in-Picture, extension qovluğu seçmə UI-si, Chrome Web Store/CRX install. Electron bu layihədə yalnız unpacked extension-ları və API-lərin məhdud hissəsini dəstəkləyir.
- Gmail və sosial şəbəkə hesablarına giriş, real adblock nəticələri, download pause/resume/cancel, private cache/download məlumatlarının forensic yoxlanması və çoxsaylı tablarla uzunmüddətli iş testi.

## Node və build

Layihə Node.js `>=22.12.0` tələb edir; Node 20.20.2 uyğun deyil. Son yoxlamalar Node 22.12.0 və npm 10.8.2 ilə aparılıb. `npm ci`, bütün JavaScript syntax yoxlamaları, 7/7 unit test və `npm audit` (0 advisory) uğurla tamamlanıb. Playwright Electron smoke suite exit code 0 ilə başa çatıb. Ətraflı nəticələr `docs/TEST_REPORT.md` sənədindədir.

**Bu mühitdə macOS `.app` və ya `.dmg` yaradılmayıb.** İş mühiti Linux x86_64-dir; macOS, Xcode, `hdiutil`, Apple signing və notarization imkanları yoxdur. Həqiqi M1 DMG-ni Apple Silicon Mac-da `scripts/build-mac-arm64.sh` ilə yaradıb, ayrıca yoxlamaq lazımdır. Cari build konfiqurasiyası ad-hoc identity istifadə edir və notarizasiya olunmuş paylama deyil.

## Əsas fayllar

- `Source-Code.zip` — mənbə kodu, sənədlər, testlər və `results` qovluğunu ehtiva edən arxiv; `node_modules` və release binary daxil deyil.
- `README.md`, `docs/INSTALLATION.md`, `docs/USER_MANUAL.md`.
- `docs/TEST_REPORT.md`, `docs/KNOWN_ISSUES.md`, `docs/SECURITY.md`.
- `scripts/build-mac-arm64.sh`, `results/electron-smoke.json`.
