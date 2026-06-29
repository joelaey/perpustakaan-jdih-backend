# Perpustakaan JDIH Sumedang - Backend API (Single Tenant)

Backend API untuk Sistem Informasi Perpustakaan JDIH (Jaringan Dokumentasi dan Informasi Hukum) Kabupaten Sumedang versi Single Tenant. Project ini dibangun menggunakan **Node.js**, **Express.js**, dan **PostgreSQL**.

---

## 🛠️ Persyaratan Sistem (Requirements)

Sebelum menjalankan aplikasi, pastikan Anda telah menginstal software berikut di komputer Anda:

*   **Node.js** (Versi LTS direkomendasikan, minimal v18.x atau lebih baru)
*   **npm** (Bawaan dari instalasi Node.js)
*   **PostgreSQL** (Versi 14 atau lebih baru, atau menggunakan PostgreSQL cloud seperti Supabase)

### ⚙️ Spesifikasi Versi Tools (DevOps Reference)

| Tool / Library | Kategori | Versi Teruji / Direkomendasikan | Catatan |
| :--- | :--- | :--- | :--- |
| **Node.js** | Runtime | `v20.x` / `v22.x` (LTS) atau `v25.1.0` | Diuji pada Node.js `v25.1.0` |
| **npm** | Package Manager | `v10.x` atau `11.6.2` | Bawaan Node.js |
| **PostgreSQL** | Database | `v14.x` s/d `v16.x` | Support Supabase PostgreSQL |
| **Express** | Web Framework | `^4.21.2` | Library utama server backend |
| **pg (node-postgres)** | DB Client | `^8.18.0` | Driver database PostgreSQL |
| **bcryptjs** | Security | `^3.0.3` | Hashing password user/admin |
| **jsonwebtoken** | Security | `^9.0.3` | Token-based Authentication |

---

## 🚀 Langkah-langkah Menjalankan Sistem

Ikuti langkah-langkah di bawah ini untuk menyiapkan dan menjalankan server backend:

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
*   **FRONTEND_URL**: URL dari aplikasi frontend untuk keperluan CORS.
    ```env
    FRONTEND_URL=http://localhost:3000
    ```

### 4. Setup Database & Migrasi
Sebelum melakukan migrasi, pastikan Anda telah membuat database di PostgreSQL dengan nama yang sesuai (misal: `jdih_sumedang`).

#### A. Migrasi Otomatis (Tabel Users & Books)
Jalankan perintah berikut untuk menginisialisasi tabel `users` dan `books`, serta membuat akun Administrator bawaan:
```bash
npm run migrate
```

#### B. Menjalankan Skrip Migrasi SQL Tambahan
Karena sistem ini juga mencakup fitur peminjaman buku dan chat/pesan, Anda perlu mengimpor file SQL migrasi tambahan yang berada di dalam folder `src/migrations/` secara berurutan ke database Anda menggunakan CLI PostgreSQL (`psql`) atau GUI Database Tool (seperti DBeaver, pgAdmin, Navicat, dll.):

1.  `src/migrations/001_create_users.sql` (Membuat tabel user & admin default)
2.  `src/migrations/002_create_books.sql` (Membuat tabel buku & index)
3.  `src/migrations/003_create_borrowings_messages.sql` (Membuat tabel peminjaman & pesan/chat)
4.  `src/migrations/004_add_borrowing_proofs.sql` (Menambahkan kolom bukti pinjam & kembali)
5.  `src/migrations/005_add_user_phone.sql` (Menambahkan kolom nomor telepon user)

> [!NOTE]
> Akun admin default yang terbuat setelah migrasi:
> *   **Email**: `admin@jdih-sumedang.go.id`
> *   **Password**: `admin123` (atau `password`)

### 5. Scraping Data Buku dari API JDIH Sumedang (Optional but Recommended)
Untuk mengisi database buku secara otomatis dari API JDIH Sumedang, jalankan perintah scraper berikut:
```bash
npm run scrape
```

### 6. Menjalankan Server Backend
*   **Mode Development** (Server akan otomatis restart setiap kali ada perubahan file menggunakan `nodemon`):
    ```bash
    npm run dev
    ```
*   **Mode Production**:
    ```bash
    npm start
    ```

Server akan berjalan secara default pada port **`5001`** (Akses API di `http://localhost:5001/api`).

---

## 📁 Struktur Folder Utama

```text
perpustakaan-jdih-backend/
├── src/
│   ├── config/          # Konfigurasi database & modul luar
│   ├── controllers/     # Logika bisnis/kontroler API
│   ├── middleware/      # Auth & middleware penunjang
│   ├── migrations/      # File SQL migrasi database
│   ├── routes/          # Defini route API
│   ├── scripts/         # Skrip helper (migrate, scrape, dll)
│   └── app.js           # Entrypoint aplikasi utama
├── .env.example         # Template environment variables
├── package.json         # Dependensi & script npm
└── alter_db.js          # Skrip perubahan DB manual
```
