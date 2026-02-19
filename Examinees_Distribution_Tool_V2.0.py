import os
import math
import pandas as pd
import ttkbootstrap as tb
from tkinter import filedialog, messagebox, Toplevel, Text, Scrollbar, RIGHT, Y, END, Canvas, Frame
from ttkbootstrap.constants import *


class MultiCenterExamDistributor:
    def __init__(self, root):
        self.root = root
        self.root.title("Multi-Center Exam Distributor")
        self.root.geometry("1450x768")
        self.root.resizable(True, True)

        self.excel_path = None
        self.df = None
        self.sheet_name = None
        self.rounds_per_day = 0
        self.round_times = []
        self.centers = []
        self.analyzed = None

        self.build_ui()

    def build_ui(self):
        # Scrollable canvas
        canvas = Canvas(self.root)
        scrollbar = Scrollbar(self.root, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)

        scrollbar.pack(side=RIGHT, fill=Y)
        canvas.pack(fill="both", expand=True)

        self.main_frame = Frame(canvas)
        canvas.create_window((0, 0), window=self.main_frame, anchor="nw")
        self.main_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))

        style_frame = tb.Frame(self.main_frame, padding=10)
        style_frame.pack(fill="both", expand=True)

        # File selection
        tb.Button(style_frame, text="Select Examinees Excel File", command=self.load_excel, bootstyle=PRIMARY).pack(pady=5)
        self.file_label = tb.Label(style_frame, text="No file selected", bootstyle=SECONDARY)
        self.file_label.pack()

        self.sheet_combo = tb.Combobox(style_frame, state="readonly", width=50)
        self.sheet_combo.pack(pady=5)
        self.sheet_combo.bind("<<ComboboxSelected>>", lambda e: setattr(self, 'sheet_name', self.sheet_combo.get()))

        # Rounds
        rounds_frame = tb.Labelframe(style_frame, text="Rounds Per Day", padding=10)
        rounds_frame.pack(fill="x", pady=10)

        self.round_entry = tb.Entry(rounds_frame, width=5)
        self.round_entry.pack(side="left", padx=(0, 10))
        tb.Button(rounds_frame, text="Set Round Timings", command=self.set_rounds).pack(side="left")

        self.round_frame = tb.Frame(style_frame)
        self.round_frame.pack(fill="x", pady=5)

        # Centers
        center_frame = tb.Labelframe(style_frame, text="Centers", padding=10)
        center_frame.pack(fill="x", pady=10)

        self.center_count_entry = tb.Entry(center_frame, width=5)
        self.center_count_entry.pack(side="left", padx=(0, 10))
        tb.Button(center_frame, text="Set Centers", command=self.set_centers).pack(side="left")

        self.center_inputs_frame = tb.Frame(style_frame)
        self.center_inputs_frame.pack(fill="x", pady=5)

        # Actions
        tb.Button(style_frame, text="Analyze and Preview Report", command=self.preview_report, bootstyle=SUCCESS).pack(pady=10)
        tb.Button(style_frame, text="Generate Files", command=self.export_files, bootstyle=WARNING).pack(pady=5)

        tb.Label(style_frame, text="Created by Eng. Firas Kiftaro — Have a nice day!",
                 font=("Arial", 9, "italic"), bootstyle=SECONDARY).pack(pady=10)

    def load_excel(self):
        path = filedialog.askopenfilename(filetypes=[("Excel files", "*.xlsx *.xls")])
        if not path:
            return
        try:
            xls = pd.ExcelFile(path)
            self.excel_path = path
            self.sheet_combo['values'] = xls.sheet_names
            self.sheet_combo.current(0)
            self.sheet_name = xls.sheet_names[0]
            self.file_label.config(text=os.path.basename(path))
        except Exception as e:
            messagebox.showerror("Error", f"Could not read Excel: {e}")

    def set_rounds(self):
        for widget in self.round_frame.winfo_children():
            widget.destroy()
        try:
            self.rounds_per_day = int(self.round_entry.get())
            self.round_times = []
            for i in range(self.rounds_per_day):
                row = tb.Frame(self.round_frame)
                row.pack(pady=2)
                tb.Label(row, text=f"Round {i+1} From:").pack(side="left")
                start = tb.Entry(row, width=10)
                start.pack(side="left", padx=5)
                tb.Label(row, text="To:").pack(side="left")
                end = tb.Entry(row, width=10)
                end.pack(side="left", padx=5)
                self.round_times.append((start, end))
        except ValueError:
            messagebox.showerror("Error", "Invalid number of rounds.")

    def set_centers(self):
        for widget in self.center_inputs_frame.winfo_children():
            widget.destroy()
        try:
            count = int(self.center_count_entry.get())
            self.centers = []
            for i in range(count):
                frame = tb.Labelframe(self.center_inputs_frame, text=f"Center {i+1}", padding=10)
                frame.pack(fill="x", pady=5)

                name = tb.Entry(frame, width=25)
                link = tb.Entry(frame, width=50)
                labs_count = tb.Entry(frame, width=5)

                tb.Label(frame, text="Center Name:").grid(row=0, column=0)
                name.grid(row=0, column=1, padx=5)
                tb.Label(frame, text="Google Maps Link:").grid(row=0, column=2)
                link.grid(row=0, column=3, padx=5)
                tb.Label(frame, text="Number of Labs:").grid(row=0, column=4)
                labs_count.grid(row=0, column=5, padx=5)

                lab_frame = tb.Frame(frame)
                lab_frame.grid(row=1, column=0, columnspan=6, pady=5)

                btn = tb.Button(frame, text="Set Labs", bootstyle=SECONDARY,
                                command=lambda f=lab_frame, e=labs_count: self.set_labs(f, e))
                btn.grid(row=0, column=6, padx=5)

                self.centers.append({
                    "name": name,
                    "link": link,
                    "labs_entry": labs_count,
                    "labs_frame": lab_frame,
                    "labs": []
                })
        except ValueError:
            messagebox.showerror("Error", "Invalid number of centers.")

    def set_labs(self, frame, entry):
        for widget in frame.winfo_children():
            widget.destroy()
        try:
            n = int(entry.get())
            labs = []
            for i in range(n):
                row = tb.Frame(frame)
                row.pack(fill="x", pady=2)
                tb.Label(row, text=f"Lab {i+1} Name:").pack(side="left")
                name = tb.Entry(row, width=25)
                name.pack(side="left", padx=5)
                tb.Label(row, text="Capacity:").pack(side="left")
                cap = tb.Entry(row, width=10)
                cap.pack(side="left", padx=5)
                labs.append((name, cap))
            for center in self.centers:
                if center['labs_frame'] == frame:
                    center['labs'] = labs
        except ValueError:
            messagebox.showerror("Error", "Invalid number of labs.")

    def preview_report(self):
        try:
            self.analyze_distribution()
            win = Toplevel(self.root)
            win.title("Distribution Report")
            win.geometry("800x600")
            text = Text(win, font=("Courier", 10), wrap="none")
            text.pack(fill="both", expand=True)
            scrollbar = Scrollbar(win, orient="vertical", command=text.yview)
            scrollbar.pack(side=RIGHT, fill=Y)
            text.config(yscrollcommand=scrollbar.set)
            text.insert(END, self.analyzed['report'])
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def analyze_distribution(self):
        df = pd.read_excel(self.excel_path, sheet_name=self.sheet_name)
        total_examinees = len(df)
        all_labs = []
        for center in self.centers:
            cname = center['name'].get()
            clink = center['link'].get()
            for lab in center['labs']:
                labname = lab[0].get()
                cap = int(lab[1].get())
                all_labs.append((cname, labname, cap, clink))

        rounds = self.rounds_per_day
        capacity_per_round = sum([l[2] for l in all_labs])
        daily_capacity = rounds * capacity_per_round
        days_needed = math.ceil(total_examinees / daily_capacity)
        summary = {d: [0]*rounds for d in range(1, days_needed+1)}

        report = []
        report.append("Exam Distribution Summary")
        report.append("=========================")
        report.append(f"Total Examinees       : {total_examinees}")
        report.append(f"Number of Labs        : {len(all_labs)}")
        report.append(f"Rounds per Day        : {rounds}")
        report.append(f"Capacity Per Round    : {capacity_per_round}")
        report.append(f"Total Daily Capacity  : {daily_capacity}")
        report.append(f"Recommended Days      : {days_needed}\n")

        round_headers = [f"Round {i+1}" for i in range(rounds)]
        report.append("Distribution Table (Per Day & Round):")
        report.append("-" * (5 + 12 * rounds))
        report.append("Day".ljust(8) + ''.join(r.ljust(12) for r in round_headers))
        report.append("-" * (5 + 12 * rounds))

        i = 0
        for d in range(1, days_needed+1):
            for r in range(1, rounds+1):
                used = 0
                for lab in all_labs:
                    for _ in range(lab[2]):
                        if i >= total_examinees:
                            break
                        i += 1
                        used += 1
                summary[d][r-1] = used
                if i >= total_examinees:
                    break
            if i >= total_examinees:
                break

        for day, counts in summary.items():
            report.append(str(day).ljust(8) + ''.join(str(c).ljust(12) for c in counts))

        report.append("\n© 2025 Firas Kiftaro. All rights reserved.\n")
        self.analyzed = {
            "df": df,
            "labs": all_labs,
            "rounds": rounds,
            "days": days_needed,
            "summary": summary,
            "report": "\n".join(report)
        }

    def export_files(self):
        try:
            if not self.analyzed:
                self.analyze_distribution()
            df = self.analyzed["df"]
            labs = self.analyzed["labs"]
            rounds = self.analyzed["rounds"]
            days = self.analyzed["days"]

            idx = 0
            base = "Exam_Distribution"
            os.makedirs(base, exist_ok=True)

            for d in range(1, days+1):
                with pd.ExcelWriter(f"{base}/Day_{d}.xlsx") as writer:
                    for r in range(1, rounds+1):
                        round_data = []
                        for cname, lname, cap, clink in labs:
                            for _ in range(cap):
                                if idx >= len(df):
                                    break
                                original_row = df.iloc[idx].copy()
                                additional_data = {
                                    "Center": cname,
                                    "Lab": lname,
                                    "Day Number": d,
                                    "Time": f"{self.round_times[r-1][0].get()} - {self.round_times[r-1][1].get()}",
                                    "Round Number": r,
                                    "Center Link": clink
                                }
                                for col, val in additional_data.items():
                                    original_row[col] = val
                                round_data.append(original_row)
                                idx += 1
                        if round_data:
                            pd.DataFrame(round_data).to_excel(writer, sheet_name=f"Round_{r}", index=False)
                        if idx >= len(df):
                            break
                if idx >= len(df):
                    break

            messagebox.showinfo("Done", f"Files exported to: {base}")
        except Exception as e:
            messagebox.showerror("Export Error", str(e))


if __name__ == "__main__":
    root = tb.Window(themename="cosmo")
    app = MultiCenterExamDistributor(root)
    root.mainloop()
