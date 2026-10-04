# Titiplen.id — Jastip Management System

Next.js App Router MVP untuk dua POV: **admin operasional** dan **customer berdasarkan nomor HP terverifikasi**.

> ⚠️ **Status:** source MVP sudah ter-deploy di Vercel dan skema sudah terpasang pada project Supabase Titiplen.id (`pukkwituooodcbtdruki`). Login admin, OTP SMS, QRIS asli, dan verifikasi end-to-end belum selesai; jangan gunakan untuk transaksi riil sebelum semuanya diuji. Jangan gunakan untuk transaksi riil sebelum database, OTP, QRIS, dan pengujian siap. Data demo hanya contoh dan tersimpan di localStorage browser.

## Deployment Titiplen.id

- Production URL: https://titiplen-id-das-7350.vercel.app/
- Admin: https://titiplen-id-das-7350.vercel.app/admin
- Customer: https://titiplen-id-das-7350.vercel.app/cek-invoice
- Aktivasi admin: https://titiplen-id-das-7350.vercel.app/auth/accept-invite
- Vercel project: `titiplen-id` (DAS team, **project terpisah**, bukan project Dashboard Marketing).
- Supabase: `pukkwituooodcbtdruki` (akun/project khusus Titiplen, **tidak memakai database PertaLife**).

**Wajib sebelum mengundang admin:**
1. Supabase Titiplen → Authentication → URL Configuration → ubah **Site URL** dari localhost ke **https://titiplen-id-das-7350.vercel.app/auth/accept-invite**.
2. Tambahkan **Redirect URL** HTTPS yang benar pada URL Configuration (setidaknya route `/auth/accept-invite`).
3. Jika undangan email sebelumnya telah dibuka dan diarahkan ke localhost, cek Authentication → Users. Jika user belum confirmed, kirim undangan ulang. Jika sudah confirmed tetapi belum set password, kirim **password recovery email** agar bisa membuka route aktivasi dengan session baru.
4. Akun yang sudah diverifikasi dan memiliki password masih memerlukan grant allowlist `admin_users` melalui SQL Editor sesuai instruksi di bawah. Jangan membuat admin dari data `user_metadata`.
5. Uji login admin dan query Supabase dengan akun tersebut. Layanan SMS OTP untuk customer masih perlu dikonfigurasi sendiri; jangan membuka transaksi riil sebelum pengujian selesai.

## Lingkup MVP

**Admin (/admin)**
- Login email/password Supabase Auth dan allowlist admin_users di database.
- Dashboard pendapatan, modal, laba event, overhead, piutang invoice, kas terverifikasi.
- Input customer dan event; rekap barang per event dan ekspor CSV.
- Input pesanan banyak barang (modal **per unit**, fee jastip **per unit**, add fee **per unit**, ongkir ditagih **per baris**, ongkir aktual **per baris**, diskon **per baris**).
- Semua kolom nominal admin otomatis tampil `Rp 1.250.000` saat mengetik atau paste. State dan database tetap menyimpan integer `1250000` (tanpa titik), sehingga perhitungan dan ekspor CSV tetap numerik. Input mengizinkan perbaikan angka di tengah tanpa memindahkan kursor ke akhir.
- Invoice baru menggabungkan barang satu customer, termasuk lintas-event, tanpa double-billing.
- Konfirmasi pembayaran QRIS manual setelah admin mencocokkan mutasi, mendukung DP.
- Catat biaya per event atau biaya umum.
- Pengaturan nomor WA admin dan URL gambar QRIS.

**Customer (/cek-invoice)**
- Verifikasi nomor HP dengan **Supabase Phone Auth SMS OTP** pada mode produksi. Nomor HP yang hanya diketik **tidak** cukup untuk melihat pesanan.
- Lihat invoice sendiri, barang, varian, Qty, total tagihan, total terbayar dan sisa tagihan.
- Scan/lihat QRIS **statis** yang diatur admin. QR tidak otomatis mengisi nominal.
- Tombol WhatsApp admin dengan draft konfirmasi pembayaran, **tidak** mengubah status tagihan otomatis.

## Mulai secara lokal (demo)

1. Install Node.js 20+ dan npm.
2. Jalankan: npm install (kemudian commit package-lock.json yang dihasilkan).
3. Salin .env.example menjadi .env.local.
4. Biarkan NEXT_PUBLIC_DEMO_MODE=true.
5. Jalankan: npm run dev, lalu buka http://localhost:3000, /admin, /cek-invoice.
6. Untuk tes customer demo, ketik 081234567890. **Jangan** kirim WhatsApp ke nomor dummy dari demo.
7. Perubahan demo disimpan hanya di browser yang sama, bukan database.

## Koneksi ke Supabase akun terpisah

**Jangan gunakan project** pertalife-marketing-dashboard (Supabase PertaLife) untuk Titiplen.id. Buat akun/organization Supabase baru khusus Titiplen; buat project titiplen-id pada region Singapore (ap-southeast-1). Project lain di organisasi sama juga memisahkan database dan sebagian kuota project, tetapi akun terpisah mengisolasi kepemilikan dan billing lebih jelas.

1. Pada **Supabase project Titiplen saja**, buka SQL Editor dan jalankan supabase/schema.sql, kemudian supabase/002_customer_events_policy.sql dan terakhir supabase/003_security_hardening.sql. Skrip jangan dijalankan pada database PertaLife.
2. Di Authentication → Providers: aktifkan email/password untuk admin, **Phone Auth + SMS provider** untuk customer. Tanpa penyedia SMS, OTP tidak akan berfungsi. OTP via WhatsApp bukan yang diimplementasikan saat ini.
3. Buat akun admin melalui **Supabase Titiplen → Authentication → Users → Add user → Send invitation** (email admin dipilih pemilik bisnis). Minta pemilik email membuka undangan, melengkapi akun, dan memverifikasi email.
   Setelah akun terdaftar dan email TERKONFIRMASI, pemilik database dapat memberi peran Super Admin melalui SQL Editor project Titiplen berikut. Perintah ini tidak berpengaruh bila email belum dikonfirmasi:

    insert into public.admin_users(user_id)
    select id from auth.users
    where lower(email) = lower('EMAIL_ADMIN_ANDA')
      and email_confirmed_at is not null
    on conflict do nothing;

   **Jangan bagikan password admin di chat, GitHub, atau source code.** Pendaftaran pengguna via Supabase Auth tidak otomatis menjadi admin tanpa grant eksplisit di atas.

4. Pada deployment Vercel baru khusus Titiplen, isi env berikut (variabel publik tidak boleh berisi credential rahasia):

    NEXT_PUBLIC_DEMO_MODE=false
    NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY

   **JANGAN** masukkan service_role atau secret ke source code atau variabel NEXT_PUBLIC_.
5. Di /admin → Pengaturan, isi nomor WhatsApp admin format 628... dan URL HTTPS gambar QRIS resmi. Pastikan merchant QRIS benar.
6. Uji SMS OTP, isolasi data antar-customer, DP, invoice gabungan, serta kesesuaian mutasi secara menyeluruh sebelum dipublikasikan.

## Aturan keuangan

- Total jual baris = Qty × (modal/unit + fee/unit + add fee/unit) + ongkir yang ditagihkan − diskon.
- Modal dan biaya langsung baris = Qty × modal/unit + ongkir aktual yang dibayar.
- Laba baris = total jual baris − modal dan biaya langsung baris.
- Laba event = jumlah laba barang di event − biaya event.
- Laba usaha = jumlah laba semua barang − biaya semua event − overhead umum.
- Dashboard menampilkan estimasi laba dari seluruh pesanan tercatat, bukan hanya pesanan yang sudah dibayar; piutang dan pembayaran terverifikasi terpisah. Model ini belum menangani stok, persediaan belum terjual, retur, pajak, kurs, dan alokasi biaya multi-event kompleks.
- Invoice hanya mengelompokkan barang untuk penagihan; event asal tidak berubah saat invoice lintas-event.
- QRIS statis **tidak** mengirim webhook; admin cocokkan mutasi dan catat pembayaran. WhatsApp bukan persetujuan otomatis.

## Migrasi Excel lama

Data Input.xlsx adalah sumber bisnis dan **belum otomatis diimpor**. Jangan langsung mengalikan Qty × Harga dari data lama: sebagian baris Excel merepresentasikan harga total per baris, berbeda dengan skema baru yang menyimpan harga **per unit**.
1. Normalisasi nomor HP customer sebelum membuka portal customer; sumber lama belum menyediakan nomor HP terverifikasi.
2. Lengkapi event kosong atau simpan sebagai Tanpa event.
3. Rekonsiliasi Qty, modal baris, fee baris, ongkir, diskon dan status pelunasan.
4. Identifikasi invoice dan DP lama agar tidak menagih ganda.
5. Impor setelah pemeriksaan sampel dan total rekonsiliasi terhadap Excel.

## Yang belum termasuk MVP produksi

- Connect **Supabase akun Titiplen tersendiri**, terapkan skema, buat akun admin, setup SMS OTP, QRIS dan WA asli.
- Uji build dan E2E pada deployment Titiplen; kredensial dan layanan belum tersedia saat commit awal.
- Excel importer dengan rekonsiliasi dan penanganan duplikat.
- Edit/void invoice, retur, audit trail, alokasi biaya lintas-event, stok, pagination server-side untuk data besar, throttling OTP, dan backup rutin.
- Commit package-lock.json setelah npm install (versi dependency sudah dipin di package.json).

## Keamanan

Database memakai Row Level Security pada seluruh tabel. Admin dibatasi allowlist admin_users. Customer tidak diberi SELECT langsung ke tabel transaksi (terutama modal barang, biaya internal, dan referensi pembayaran). Setelah OTP SMS dan validasi `auth.users.phone_confirmed_at`, customer hanya mengambil proyeksi aman melalui RPC `get_titiplen_customer_portal()` berdasarkan nomor dari JWT: barang, Qty, total harga jual, invoice, saldo, serta QRIS/WA. RPC `SECURITY DEFINER` ini memang diekspos kepada user authenticated agar dapat membaca proyeksi tanpa mendapatkan akses mentah ke tabel; Supabase security linter dapat memperingatkan hal ini, sehingga setiap perubahan perlu diaudit. Nomor HP dari parameter input tidak bisa dipakai untuk mengakses pesanan.

**Jangan** memasukkan data pribadi, kunci rahasia, atau bukti pembayaran ke repository public. Sebaiknya ubah repository ke Private sebelum data operasional.
