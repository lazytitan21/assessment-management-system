import os
import pandas as pd
import tkinter as tk
from tkinter import filedialog
import ttkbootstrap as tb
from ttkbootstrap.constants import *
import win32com.client as win32

# Log file path
log_file = "email_log.txt"

def send_email_with_outlook(to_email, subject, arabic_html, english_html, attachment_path):
    outlook = win32.Dispatch('Outlook.Application')
    mail = outlook.CreateItem(0)
    mail.To = to_email
    mail.Subject = subject
    mail.HTMLBody = f"""
    <html>
        <body>
            <table border="0" style="width:100%;">
                <tr>
                    <td style="width:50%;">
                        <div dir='ltr' style='text-align:left; font-family:Sakkal Majalla, serif; font-size:14pt;'>
                            {english_html}
                        </div>
                    </td>
                    <td style="width:50%;">
                        <div dir='rtl' style='text-align:right; font-family:Sakkal Majalla, serif; font-size:14pt;'>
                            {arabic_html}
                        </div>
                    </td>
                </tr>
            </table>
        </body>
    </html>
    """
    if attachment_path:
        mail.Attachments.Add(attachment_path)
    mail.Send()

def send_emails():
    spinner_label.pack()
    status_label.config(text="", foreground="green")
    preview_box.delete("1.0", tk.END)
    with open(log_file, "w", encoding="utf-8") as log:
        try:
            df = pd.read_excel(excel_path.get())
            for _, row in df.iterrows():
                match_value = str(row[match_col.get()]).strip()
                to_email = row[email_col.get()]
                matched_file = next((f for f in os.listdir(folder_path.get()) if match_value in f), None)
                if matched_file:
                    attachment_path = os.path.join(folder_path.get(), matched_file)
                    send_email_with_outlook(
                        to_email,
                        subject_entry.get().strip(),
                        arabic_box.get("1.0", "end").strip().replace("\n", "<br>"),
                        english_box.get("1.0", "end").strip().replace("\n", "<br>"),
                        attachment_path
                    )
                    msg = f"✅ Email sent to: {to_email} with file: {matched_file}"
                else:
                    msg = f"⚠️ No attachment found for: {match_value} (email: {to_email})"
                log.write(msg + "\n")
                preview_box.insert(tk.END, msg + "\n")
            status_label.config(text="✅ All emails processed. See log below.", foreground="green")
        except Exception as e:
            error_msg = f"❌ Error: {str(e)}"
            status_label.config(text=error_msg, foreground="red")
            log.write(error_msg + "\n")
            preview_box.insert(tk.END, error_msg + "\n")
        finally:
            spinner_label.pack_forget()

def browse_excel():
    path = filedialog.askopenfilename(filetypes=[("Excel files", "*.xlsx *.xls")])
    if path:
        excel_path.set(path)
        df = pd.read_excel(path)
        cols = df.columns.tolist()
        match_col_menu['values'] = cols
        email_col_menu['values'] = cols

def browse_folder():
    path = filedialog.askdirectory()
    if path:
        folder_path.set(path)

def force_arabic_rtl(*args):
    arabic_box.tag_add("rtl", "1.0", "end")

def bind_text_shortcuts(widget):
    def select_all(event): widget.tag_add("sel", "1.0", "end"); return "break"
    def copy(event): widget.event_generate("<<Copy>>"); return "break"
    def paste(event): widget.event_generate("<<Paste>>"); return "break"
    def cut(event): widget.event_generate("<<Cut>>"); return "break"
    def undo(event): widget.event_generate("<<Undo>>"); return "break"
    def redo(event): widget.event_generate("<<Redo>>"); return "break"
    for key, func in {
        "<Control-a>": select_all, "<Control-A>": select_all,
        "<Control-c>": copy, "<Control-C>": copy,
        "<Control-v>": paste, "<Control-V>": paste,
        "<Control-x>": cut, "<Control-X>": cut,
        "<Control-z>": undo, "<Control-Z>": undo,
        "<Control-y>": redo, "<Control-Y>": redo,
    }.items():
        widget.bind(key, func)

# GUI Setup
root = tb.Window(themename="cosmo")
root.title("📧 Smart Attachment Email Sender")
root.geometry("1600x1300")

excel_path = tk.StringVar()
folder_path = tk.StringVar()
match_col = tk.StringVar()
email_col = tk.StringVar()

# Header
tb.Label(root, text="📨 Smart Attachment Email Sender", font=("Segoe UI", 22, "bold")).pack(pady=(10, 5))
tb.Label(root, text="Created by Eng. Firas Kiftaro", font=("Segoe UI", 11), foreground="gray").pack(pady=(0, 10))

main_frame = tb.Frame(root, padding=20)
main_frame.pack(fill="both", expand=True)

# Step 1
file_frame = tb.Labelframe(main_frame, text="Step 1: 📁 File & Folder Selection", padding=15)
file_frame.pack(fill="x", pady=10)

tb.Label(file_frame, text="Excel File:", font=("Arial", 11)).grid(row=0, column=0, sticky="w", padx=5, pady=5)
tb.Entry(file_frame, textvariable=excel_path, width=60).grid(row=0, column=1, padx=5, pady=5)
tb.Button(file_frame, text="Browse", command=browse_excel).grid(row=0, column=2, padx=5)

tb.Label(file_frame, text="Attachments Folder:", font=("Arial", 11)).grid(row=1, column=0, sticky="w", padx=5, pady=5)
tb.Entry(file_frame, textvariable=folder_path, width=60).grid(row=1, column=1, padx=5, pady=5)
tb.Button(file_frame, text="Browse", command=browse_folder).grid(row=1, column=2, padx=5)

# Step 2
column_frame = tb.Labelframe(main_frame, text="Step 2: 🧩 Column Mapping", padding=15)
column_frame.pack(fill="x", pady=10)

tb.Label(column_frame, text="Match File with Column:", font=("Arial", 11)).grid(row=0, column=0, sticky="w", padx=5, pady=5)
match_col_menu = tb.Combobox(column_frame, textvariable=match_col, width=57)
match_col_menu.grid(row=0, column=1, padx=5, pady=5)

tb.Label(column_frame, text="Email Column:", font=("Arial", 11)).grid(row=1, column=0, sticky="w", padx=5, pady=5)
email_col_menu = tb.Combobox(column_frame, textvariable=email_col, width=57)
email_col_menu.grid(row=1, column=1, padx=5, pady=5)

# Step 3
content_frame = tb.Labelframe(main_frame, text="Step 3: 📝 Email Content", padding=15)
content_frame.pack(fill="both", pady=10, expand=True)

tb.Label(content_frame, text="Email Subject:", font=("Arial", 11)).grid(row=0, column=0, sticky="w", padx=5, pady=5)
subject_entry = tb.Entry(content_frame, width=70)
subject_entry.grid(row=0, column=1, columnspan=2, sticky="w", padx=5, pady=5)

tb.Label(content_frame, text="English Message:", font=("Arial", 11)).grid(row=1, column=0, sticky="nw", padx=5, pady=5)
english_box = tk.Text(content_frame, height=12, width=50, wrap="word", font=("Segoe UI", 11), undo=True, maxundo=-1)
english_box.grid(row=1, column=1, sticky="w", padx=5, pady=5)

tb.Label(content_frame, text="Arabic Message:", font=("Arial", 11)).grid(row=1, column=2, sticky="nw", padx=5, pady=5)
arabic_box = tk.Text(content_frame, height=12, width=50, wrap="word", font=("Segoe UI", 11), undo=True, maxundo=-1)
arabic_box.grid(row=1, column=3, sticky="w", padx=5, pady=5)
arabic_box.tag_configure("rtl", justify="right")
arabic_box.insert("1.0", "")
arabic_box.tag_add("rtl", "1.0", "end")
arabic_box.bind("<KeyRelease>", force_arabic_rtl)

bind_text_shortcuts(english_box)
bind_text_shortcuts(arabic_box)

# Send Button + Spinner + Status
button_frame = tb.Frame(main_frame)
button_frame.pack(pady=20)

send_button = tb.Button(button_frame, text="🚀 Send Emails", bootstyle=SUCCESS, width=30, command=send_emails)
send_button.pack()

spinner_label = tb.Label(button_frame, text="⏳ Sending emails...", font=("Segoe UI", 10), foreground="blue")
spinner_label.pack()
spinner_label.pack_forget()

status_label = tb.Label(button_frame, text="", font=("Segoe UI", 10), foreground="green")
status_label.pack()

# Preview Log Box
preview_frame = tb.Labelframe(main_frame, text="📄 Live Email Log Preview", padding=15)
preview_frame.pack(fill="both", expand=True, pady=10)

preview_box = tk.Text(preview_frame, height=15, font=("Consolas", 10), wrap="word")
preview_box.pack(fill="both", expand=True)

root.mainloop()
