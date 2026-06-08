# MC PRIME Exchange — بورصة المونديال الافتراضية

MC PRIME Exchange is a virtual sports exchange platform where users can trade virtual shares of football teams and players. Prices dynamically react to real-world performance, goals, assists, injuries, and market supply and demand.

> [!WARNING]
> **Safety Note / تنبيه هام**:
> All coins and credits in this platform are completely virtual and exist solely for gaming and fantasy purposes. They cannot be withdrawn, transferred, or exchanged for real money.
> جميع العملات والكوينز في هذه المنصة افتراضية بالكامل، ولا يمكن سحبها أو استبدالها بنقود حقيقية.

---

## Tech Stack
- **Framework**: [Next.js (App Router)](https://nextjs.org/)
- **Database**: PostgreSQL (hosted on Render/Supabase)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Styling**: Vanilla CSS / TailwindCSS
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Authentication**: NextAuth.js (Credentials & Google Providers)

---

## Setup & Running Locally

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory (based on `.env` or sample values below):
   ```env
   DATABASE_URL="postgresql://username:password@hostname:port/database"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-32-character-secret-key"
   FOOTBALL_DATA_API_KEY="your-football-data-org-api-key"
   
   # Optional Google Auth
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   ```

3. **Synchronize Database Schema**:
   Push the database schema directly using Prisma:
   ```bash
   npx prisma db push
   ```

4. **Seed Database with initial Assets (Teams/Players/Matches)**:
   ```bash
   npx ts-node prisma/seed.ts
   ```

5. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to trade!

---

## Prisma Commands Reference

- **Generate Client**: `npx prisma generate`
- **Push Schema changes**: `npx prisma db push`
- **Open Prisma Studio (DB Browser)**: `npx prisma studio`
- **Reset Database**: `npx prisma db push --force-reset`

---

## Performance Enhancements (Upcoming)
- Split `/api/assets` endpoints to request specific views (`GET /api/assets?view=market` vs full data).
- Lazy-load historical charts and squads to improve initial loading times.
