using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

class BrioSetup : Form {
    readonly Button install = new Button();
    readonly Label status = new Label();
    bool busy;
    [STAThread] static void Main(string[] args) {
        if (args.Length == 2 && args[0] == "--verify-payload") {
            try { Extract(Path.GetFullPath(args[1])); } catch { Environment.ExitCode = 1; } return;
        }
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new BrioSetup());
    }
    BrioSetup() {
        Text = "تثبيت Brio LAN"; Size = new Size(570, 350); FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 11); RightToLeft = RightToLeft.Yes; RightToLeftLayout = true;
        var panel = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(24) }; Controls.Add(panel);
        panel.Controls.Add(new Label { Text = "Brio LAN", Font = new Font("Segoe UI", 23, FontStyle.Bold), Width = 490, Height = 55 });
        panel.Controls.Add(new Label { Text = "تثبيت على حسابك الحالي دون صلاحيات مسؤول. يُضاف اختصار إلى قائمة ابدأ وسطح المكتب. لا تحتاج إلى Node أو أوامر CMD.", Width = 490, Height = 70 });
        status.Text = "Windows 10/11 · x64 · البيانات محفوظة منفصلة عن ملفات التطبيق"; status.Width = 490; status.Height = 50; panel.Controls.Add(status);
        install.Text = "تثبيت وفتح Brio"; install.Width = 250; install.Height = 45; install.Click += async (s,e) => await Install(); panel.Controls.Add(install);
        FormClosing += (s,e) => { if (busy) e.Cancel = true; };
    }
    async Task Install() {
        if (!Environment.Is64BitOperatingSystem) { MessageBox.Show("هذه النسخة تحتاج Windows x64."); return; }
        busy = true; install.Enabled = false; status.Text = "جاري التثبيت…";
        try {
            string parent = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Brio", "versions");
            string target = Path.Combine(parent, "release-" + Guid.NewGuid().ToString("N"));
            await Task.Run(() => Extract(target));
            string executable = Path.Combine(target, "Brio.exe");
            if (!File.Exists(executable)) throw new InvalidDataException("Brio.exe missing");
            CreateShortcut(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), executable);
            CreateShortcut(Environment.GetFolderPath(Environment.SpecialFolder.Programs), executable);
            using (var key = Registry.CurrentUser.CreateSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\BrioLAN")) {
                key.SetValue("DisplayName", "Brio LAN"); key.SetValue("DisplayVersion", "0.1.0-pilot");
                key.SetValue("Publisher", "Brio"); key.SetValue("DisplayIcon", executable);
                key.SetValue("InstallLocation", target);
                key.SetValue("UninstallString", "\"" + Path.Combine(target, "Uninstall.exe") + "\"");
                key.SetValue("NoModify", 1); key.SetValue("NoRepair", 1);
            }
            status.Text = "تم التثبيت. افتح Brio من سطح المكتب أو قائمة ابدأ.";
            Process.Start(new ProcessStartInfo(executable) { UseShellExecute = true });
            install.Text = "تم التثبيت";
        } catch (Exception error) { status.Text = "تعذّر التثبيت: " + error.Message; install.Enabled = true; }
        finally { busy = false; }
    }
    static void Extract(string target) {
        if (Directory.Exists(target)) throw new IOException("Destination already exists");
        Directory.CreateDirectory(target);
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Brio.Payload"))
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Read)) {
            foreach (var entry in archive.Entries) {
                string file = Path.GetFullPath(Path.Combine(target, entry.FullName));
                if (!file.StartsWith(target + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Invalid package path");
                if (String.IsNullOrEmpty(entry.Name)) { Directory.CreateDirectory(file); continue; }
                Directory.CreateDirectory(Path.GetDirectoryName(file)); entry.ExtractToFile(file);
            }
        }
        if (!File.Exists(Path.Combine(target, "Brio.exe")) || !File.Exists(Path.Combine(target, "runtime", "node.exe"))) throw new InvalidDataException("Incomplete package");
    }
    void CreateShortcut(string directory, string target) {
        var type = Type.GetTypeFromProgID("WScript.Shell");
        var shell = Activator.CreateInstance(type);
        var link = type.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { Path.Combine(directory, "Brio LAN.lnk") });
        var linkType = link.GetType();
        linkType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, link, new object[] { target });
        linkType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, link, new object[] { Path.GetDirectoryName(target) });
        linkType.InvokeMember("Save", BindingFlags.InvokeMethod, null, link, null);
        System.Runtime.InteropServices.Marshal.FinalReleaseComObject(link);
        System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);
    }
}
