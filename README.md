# Siki Budget 💶

App privata Android & Web per la gestione di **budget, spese, entrate e conti**, progettata su misura ispirandosi alla disposizione di *"Budget e finanze - spese"* (`ru.innim.my_finance`) con un design moderno, zero pubblicità e sincronizzazione cloud privata.

---

## Caratteristiche principali

- **Dashboard con Grafico ad Anello interattivo**:
  - Switch immediato **`SPESE` | `ENTRATE`**.
  - Periodi **`Giorno` | `Settimana` | `Mese` (dal giorno 1) | `Anno` | `Periodo personalizzato`**.
  - Card categorie ordinate per importo con **percentuale `%`**, **importo in `€`** e **barra del limite mensile** nella vista *Mese*.
  - Drill-down su ogni categoria per consultare **sottocategorie** e singole operazioni.
- **Pulsante `+` rapido con Calcolatrice e Trasferimenti**:
  - **3 tab diretti**: `Spesa` | `Entrata` | `Trasferimento` (tra conti).
  - **Tastierino con calcolatrice integrata** (`+`, `-`, `×`, `÷`, `=`, `,`).
- **Conti & Categorie su misura**:
  - Parte pulita con un unico **`Conto Principale`** (con possibilità di aggiungere altri conti, escluderli dal saldo totale, rettificare il saldo o archiviarli).
  - Categorie e sottocategorie completamente personalizzabili (icone per tema, colori, riordino e budget mensile).
- **Offline-First + Cloud Privato Supabase (`budget-finanze`)**:
  - Salvataggio locale istantaneo (`IndexedDB`) per funzionare anche senza internet.
  - Sincronizzazione automatica con database PostgreSQL privato protetto da **Row Level Security (RLS)**.
- **Importa / Esporta Excel (`.xlsx`, `.csv`) e Backup `.json`**.
- **Blocco di sicurezza con PIN a 4 cifre** e **Tema Scuro / Chiaro**.

---

## Come installare `Siki Budget` sul tuo smartphone Android

1. Apri dal browser del tuo telefono la pagina Releases di questo repository:
   👉 **`https://github.com/Siki32program/Budget-e-finanaze/releases`**
2. Tocca il file **`Siki-Budget.apk`** per scaricarlo.
3. Apri il file scaricato e premi **Installa** (se Android chiede il permesso per installare da Chrome, consenti una sola volta).

---

## Sviluppo locale

```bash
npm install
npm run dev
```

Per sincronizzare le modifiche con il progetto nativo Android:

```bash
npm run android:sync
```
