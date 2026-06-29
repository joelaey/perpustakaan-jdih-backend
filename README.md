# Perpustakaan JDIH Sumedang - Backend API (Multi-Tenant / Multi-Library)

Backend API untuk Sistem Informasi Perpustakaan JDIH (Jaringan Dokumentasi dan Informasi Hukum) Kabupaten Sumedang versi **Multi-Tenant (Multi-Library)**. Pada versi ini, sistem mendukung pengelolaan buku, stock copies, peminjaman, dan chat terdistribusi di beberapa cabang perpustakaan (seperti Perpustakaan Pusat, Tanjungsari, Jatinangor, dll.).

Project ini dibangun menggunakan **Node.js**, **Express.js**, dan **PostgreSQL**.

---

## 🛠️ Persyaratan Sistem (Requirements)

Sebelum menjalankan aplikasi, pastikan Anda telah menginstal software berikut di komputer Anda:

*   **Node.js** (Versi LTS direkomendasikan, minimal v18.x atau lebih baru)
*   **npm** (Bawaan dari instalasi Node.js)
*   **PostgreSQL** (Versi 14 atau lebih baru, atau menggunakan PostgreSQL cloud seperti Supabase)

---

## 🚀 Langkah-langkah Menjalankan Sistem

Ikuti langkah-langkah di bawah ini untuk menyiapkan dan menjalankan server backend multi-tenant:

### 1. Masuk ke Direktori Backend
Buka terminal dan masuk ke folder backend:
```bash
cd perpustakaan-jdih-backend
```

### 2. Install Dependensi
Instal semua modul Node.js yang dibutuhkan:
```bash
npm install
```

### 3. Konfigurasi Environment Variables (`.env`)
Salin file template `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Buka file `.env` yang baru dibuat dan sesuaikan konfigurasinya:
*   **DATABASE_URL**: Gunakan connection string PostgreSQL (misal dari Supabase atau PostgreSQL lokal).
    ```env
    DATABASE_URL=postgresql://username:password@localhost:5432/jdih_sumedang
    ```
    *Atau Anda dapat mengisi field individual jika `DATABASE_URL` tidak digunakan:*
    ```env
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=postgres
    DB_PASSWORD=password_postgres_kamu
    DB_NAME=jdih_sumedang
    ```
*   **JWT_SECRET**: Kunci rahasia untuk enkripsi token login (isi bebas/acak).
    ```env
    JWT_SECRET=kunci_rahasia_jwt_anda
    ```
*   **FRONTEND_URL**: URL dari aplikasi frontend Next.js untuk keperluan CORS.
    ```env
    FRONTEND_URL=http://localhost:3000
    ```

### 4. Setup Database & Migrasi (Sangat Penting untuk Multi-Tenant)
Pastikan Anda telah membuat database di PostgreSQL dengan nama yang sesuai (misal: `jdih_sumedang`).

Untuk versi Multi-Tenant, jalankan langkah-langkah migrasi berikut secara berurutan:

#### A. Migrasi Utama (Tabel Dasar)
Jalankan perintah berikut untuk menginisialisasi tabel dasar `users` dan `books`, serta akun Administrator awal:
```bash
npm run migrate
```

#### B. Mengimpor Skrip SQL Migrasi Manual
Sistem ini menggunakan fitur peminjaman, chat, dan modifikasi kolom user. Jalankan file SQL migrasi di folder `src/migrations/` secara berurutan menggunakan CLI PostgreSQL (`psql`) atau GUI Database Tool (seperti DBeaver, pgAdmin, dll.):
1.  `src/migrations/001_create_users.sql`
2.  `src/migrations/002_create_books.sql`
3.  `src/migrations/003_create_borrowings_messages.sql`
4.  `src/migrations/004_add_borrowing_proofs.sql`
5.  `src/migrations/005_add_user_phone.sql`

#### C. Menjalankan Migrasi Multi-Library & Buku Copies
Setelah tabel dasar terbentuk, jalankan migrasi database khusus fitur multi-tenant:
1.  **Migrasi Multi-Library**: Membuat tabel `libraries` dan mengubah kolom `role` pada `users` (menambahkan role `super_admin`).
    ```bash
    node src/scripts/run_004.js
    ```
2.  **Migrasi Buku & Cabang (Stock Copies)**: Membuat tabel `book_copies` untuk mencatat stok buku per cabang perpustakaan, serta memetakan data `library_id` ke tabel peminjaman.
    ```bash
    node src/scripts/run_005.js
    ```

#### D. Seed Dummy Data & Cabang Perpustakaan (Sangat Direkomendasikan)
Guna memudahkan pengujian, jalankan perintah seed berikut untuk membuat **3 Cabang Perpustakaan**, akun **Super Admin**, akun **Admin per Cabang**, serta mendistribusikan stok buku otomatis:
```bash
node src/scripts/seed_dummy.js
```

> [!IMPORTANT]
> **Kredensial Login Hasil Seeding (Password untuk semua: `admin123`):**
> *   **Super Admin** (mengelola seluruh cabang & admin): `superadmin@jdih.sumedang.go.id`
> *   **Admin Cabang Pusat**: `admin.pusat@jdih.sumedang.go.id`
> *   **Admin Cabang Tanjungsari**: `admin.tanjungsari@jdih.sumedang.go.id`
> *   **Admin Cabang Jatinangor**: `admin.jatinangor@jdih.sumedang.go.id`

---

### 5. Scraping Data Buku dari API JDIH Sumedang (Optional)
Jika ingin mengambil data katalog buku resmi JDIH Sumedang secara otomatis, jalankan:
```bash
npm run scrape
```

---

### 6. Menjalankan Server Backend
*   **Mode Development** (Server auto-restart dengan `nodemon`):
    ```bash
    npm run dev
    ```
*   **Mode Production**:
    ```bash
    npm start
    ```

Server akan berjalan secara default pada port **`5001`** (Akses API di `http://localhost:5001/api`).

---

## 📁 Struktur Folder Tambahan (Multi-Tenant)

*   `src/migrations/004_multi_library.sql`: Skema database tabel perpustakaan cabang & role super_admin.
*   `src/migrations/005_book_copies.sql`: Skema database stock buku per cabang.
*   `src/controllers/libraryController.js`: Controller API untuk cabang perpustakaan.
*   `src/routes/libraryRoutes.js`: Routing API untuk perpustakaan.
*   `src/scripts/seed_dummy.js`: Script pembuat data dummy perpustakaan, stok buku, & multi-admin.
