import type { DataSnapshot, RawBoardDataset, RawBoardItem, RawMondayColumnValue } from "@/lib/types";

const sectors = ["Mining", "Renewables", "Railways", "Powerline", "Construction", "Others"];
const stages = [
  "A. Lead Generated",
  "B. Sales Qualified Leads",
  "E. Proposal/Commercials Sent",
  "F. Negotiations",
  "G. Project Won",
  "H. Work Order Received",
];

function column(title: string, text: string | null, type = "text"): RawMondayColumnValue {
  return { id: title.toLowerCase().replace(/[^a-z0-9]+/g, "_"), title, type, text, value: text };
}

function shiftDays(reference: Date, days: number): string {
  const shifted = new Date(reference);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function generateDeals(reference: Date): RawBoardDataset {
  const items: RawBoardItem[] = Array.from({ length: 48 }, (_, index) => {
    const sector = sectors[index % sectors.length];
    const status = index % 9 === 0 ? "Dead" : index % 7 === 0 ? "Won" : index % 13 === 0 ? "On Hold" : "Open";
    const stage = stages[(index * 5) % stages.length];
    const value = index % 11 === 0 ? null : String(220_000 + ((index * 347_000) % 8_900_000));
    const tentativeDate = index === 17 ? "31/02/2026" : shiftDays(reference, (index % 21) - 10);
    const createdDate = shiftDays(reference, -25 - ((index * 13) % 380));
    const sectorValue = index === 19 ? " renewables  " : index === 31 ? sector.toUpperCase() : sector;
    return {
      id: `demo-deal-${index + 1}`,
      name: `Opportunity ${String(index + 1).padStart(2, "0")}`,
      columns: [
        column("Owner code", index % 10 === 0 ? null : `OWNER_00${(index % 5) + 1}`),
        column("Client Code", `COMPANY${String((index * 7) % 90).padStart(3, "0")}`),
        column("Deal Status", status, "status"),
        column("Close Date (A)", status === "Won" ? shiftDays(reference, -(index % 45)) : null, "date"),
        column("Closure Probability", ["Low", "Medium", "High", null][index % 4], "status"),
        column("Masked Deal value", value, "numbers"),
        column("Tentative Close Date", index % 8 === 0 ? null : tentativeDate, "date"),
        column("Deal Stage", stage, "status"),
        column("Product deal", index % 3 === 0 ? "Service + Spectra" : "Pure Service"),
        column("Sector/service", sectorValue, "dropdown"),
        column("Created Date", createdDate, "date"),
      ],
    };
  });
  return { id: "demo-deals", name: "Deals (Demo)", items };
}

function generateWorkOrders(reference: Date): RawBoardDataset {
  const statuses = ["Completed", "Ongoing", "Not Started", "Executed until current month", "Pause / struck"];
  const items: RawBoardItem[] = Array.from({ length: 30 }, (_, index) => {
    const sector = sectors[(index * 5) % sectors.length];
    const status = statuses[index % statuses.length];
    const total = 380_000 + ((index * 511_000) % 7_400_000);
    const billed = status === "Completed" ? total : Math.round(total * ((index % 6) / 7));
    const receivable = index % 9 === 0 ? -120 : Math.max(0, Math.round(billed * ((index % 4) / 8)));
    const start = shiftDays(reference, -120 + index * 5);
    const end = shiftDays(reference, -30 + index * 7);
    return {
      id: `demo-work-order-${index + 1}`,
      name: `Flight Order ${String(index + 1).padStart(2, "0")}`,
      columns: [
        column("Serial #", `SDPLDEAL-${String(index + 1).padStart(3, "0")}`),
        column("Customer Name Code", `WOCOMPANY_${String((index * 3) % 40).padStart(3, "0")}`),
        column("Nature of Work", index % 4 === 0 ? "Monthly Contract" : "One time Project"),
        column("Execution Status", status, "status"),
        column("Data Delivery Date", status === "Completed" && index % 3 ? shiftDays(reference, -index) : null, "date"),
        column("Date of PO/LOI", shiftDays(reference, -160 + index * 4), "date"),
        column("Probable Start Date", start, "date"),
        column("Probable End Date", index === 22 ? "not-a-date" : end, "date"),
        column("BD/KAM Personnel code", `OWNER_00${(index % 5) + 1}`),
        column("Sector", index === 13 ? sector.toLowerCase() : sector, "dropdown"),
        column("Type of Work", index % 2 === 0 ? "Topography Survey: RGB" : "Inspection"),
        column("Last invoice date", billed > 0 ? shiftDays(reference, -(index % 70)) : null, "date"),
        column("Amount in Rupees (Excl of GST) (Masked)", String(total), "numbers"),
        column("Billed Value in Rupees (Excl of GST.) (Masked)", billed ? String(billed) : null, "numbers"),
        column("Collected Amount in Rupees (Incl of GST.) (Masked)", billed ? String(Math.round(billed * 0.72)) : null, "numbers"),
        column("Amount Receivable (Masked)", String(receivable), "numbers"),
        column("Amount to be billed in Rs. (Exl. of GST) (Masked)", String(total - billed), "numbers"),
        column("Invoice Status", billed === total ? "Fully Billed" : billed > 0 ? "Partially Billed" : "Not billed yet", "status"),
        column("Billing Status", index % 12 === 0 ? "BIlled" : billed === total ? "Billed" : "Update Required", "status"),
      ],
    };
  });
  return { id: "demo-work-orders", name: "Work Orders (Demo)", items };
}

export function generateDemoSnapshot(reference = new Date()): DataSnapshot {
  return {
    mode: "demo",
    freshness: "simulated",
    fetchedAt: new Date().toISOString(),
    deals: generateDeals(reference),
    workOrders: generateWorkOrders(reference),
    warning: "Demo Mode uses deterministic synthetic records. It is not a substitute for the live Monday.com connection.",
  };
}
