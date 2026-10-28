using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

partial class BrioSetup : Form {
    readonly Button install = new Button();
    readonly Label status = new Label();
    bool busy;
    bool completed;
    [STAThread] static void Main(string[] args) {
        if (args.Length == 2 && args[0] == "--verify-payload") {
            try { Extract(Path.GetFullPath(args[1])); } catch { Environment.ExitCode = 1; } return;
        }
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new BrioSetup());
    }
    BrioSetup() {
        InitializeWindow();
        install.Click += async (s,e) => { if (completed) Close(); else await Install(); };
        FormClosing += (s,e) => { if (busy) e.Cancel = true; };
    }
    async Task Install() {
        if (!Environment.Is64BitOperatingSystem) { MessageBox.Show("هذه النسخة تحتاج Windows x64."); return; }
        if (Process.GetProcessesByName("Brio").Length > 0) {
            status.Text = "أغلق تطبيق Brio المفتوح أولاً، ثم اضغط تثبيت. ستبقى مسابقاتك ونتائجك محفوظة."; return;
        }
        busy = true; install.Enabled = false; status.Text = "جاري تجهيز ملفات اللعبة…";
        var updates = new Progress<int>(value => progress.Value = value);
        try {
            string parent = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Brio", "versions");
            string target = Path.Combine(parent, "release-" + Guid.NewGuid().ToString("N"));
            await Task.Run(() => Extract(target, updates));
            string executable = Path.Combine(target, "Brio.exe");
            if (!File.Exists(executable)) throw new InvalidDataException("Brio.exe missing");
            CreateShortcut(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), executable);
            CreateShortcut(Environment.GetFolderPath(Environment.SpecialFolder.Programs), executable);
            using (var key = Registry.CurrentUser.CreateSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\BrioLAN")) {
                key.SetValue("DisplayName", "Brio LAN"); key.SetValue("DisplayVersion", "0.1.1-pilot");
                key.SetValue("Publisher", "Brio"); key.SetValue("DisplayIcon", executable);
                key.SetValue("InstallLocation", target);
                key.SetValue("UninstallString", "\"" + Path.Combine(target, "Uninstall.exe") + "\"");
                key.SetValue("NoModify", 1); key.SetValue("NoRepair", 1);
            }
            status.Text = "تم التثبيت بنجاح. تجد Brio على سطح المكتب وفي قائمة ابدأ.";
            Process.Start(new ProcessStartInfo(executable) { UseShellExecute = true });
            completed = true; progress.Value = 100; install.Text = "إنهاء"; install.Enabled = true;
        } catch (Exception error) { status.Text = "تعذّر التثبيت: " + error.Message; install.Enabled = true; }
        finally { busy = false; }
    }
    static void Extract(string target, IProgress<int> updates = null) {
        if (Directory.Exists(target)) throw new IOException("Destination already exists");
        Directory.CreateDirectory(target);
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Brio.Payload"))
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Read)) {
            int extracted = 0;
            foreach (var entry in archive.Entries) {
                string file = Path.GetFullPath(Path.Combine(target, entry.FullName));
                if (!file.StartsWith(target + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Invalid package path");
                if (String.IsNullOrEmpty(entry.Name)) { Directory.CreateDirectory(file); continue; }
                Directory.CreateDirectory(Path.GetDirectoryName(file)); entry.ExtractToFile(file);
                if (updates != null) updates.Report(++extracted * 95 / Math.Max(1, archive.Entries.Count));
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
