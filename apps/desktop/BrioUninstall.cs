using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;
class BrioUninstall {
    [STAThread] static void Main(string[] args) {
        string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Brio");
        if (args.Length != 1 || args[0] != "--remove") {
            if (MessageBox.Show("إزالة تطبيق Brio؟ ستبقى مسابقاتك ونتائجك محفوظة في مجلد البيانات.", "Brio LAN", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            string temporary = Path.Combine(Path.GetTempPath(), "Brio-Uninstall-" + Guid.NewGuid().ToString("N") + ".exe");
            File.Copy(Application.ExecutablePath, temporary);
            Process.Start(new ProcessStartInfo(temporary, "--remove") { UseShellExecute = true }); return;
        }
        try {
            foreach (var process in Process.GetProcessesByName("Brio")) {
                try { if (process.MainModule.FileName.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("أغلق تطبيق Brio أولاً ثم أعد الإزالة."); }
                finally { process.Dispose(); }
            }
            string versions = Path.Combine(root, "versions");
            if (Directory.Exists(versions)) {
                RejectLinks(versions);
                Directory.Delete(versions, true);
            }
            foreach (var location in new[] { Environment.SpecialFolder.DesktopDirectory, Environment.SpecialFolder.Programs }) {
                string link = Path.Combine(Environment.GetFolderPath(location), "Brio LAN.lnk");
                if (File.Exists(link)) File.Delete(link);
            }
            using (var key = Registry.CurrentUser.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall", true)) if (key != null) key.DeleteSubKeyTree("BrioLAN", false);
            MessageBox.Show("تمت إزالة التطبيق. بقيت بياناتك في:\n" + Path.Combine(root, "data"), "Brio LAN");
        } catch (Exception error) { MessageBox.Show(error.Message, "تعذّرت إزالة Brio"); }
    }
    static void RejectLinks(string directory) {
        if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) throw new IOException("Unexpected linked folder. Removal cancelled.");
        foreach (string child in Directory.GetDirectories(directory)) RejectLinks(child);
    }
}
