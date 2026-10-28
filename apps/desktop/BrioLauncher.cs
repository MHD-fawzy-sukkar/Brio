using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

partial class BrioLauncher : Form {
    Process server;
    readonly Button start = new BrioButton(), stop = new BrioButton(), open = new BrioButton();
    readonly TextBox details = new TextBox();
    readonly System.Windows.Forms.Timer health = new System.Windows.Forms.Timer();
    bool stopping;
    readonly string root = AppDomain.CurrentDomain.BaseDirectory;
    readonly string data = Environment.GetEnvironmentVariable("BRIO_DESKTOP_DATA") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Brio", "data");
    readonly string port = Environment.GetEnvironmentVariable("BRIO_DESKTOP_PORT") ?? "3210";

    [STAThread] static void Main() {
        bool created;
        using (var mutex = new Mutex(true, "Local\\BrioLANDesktop", out created)) {
            if (!created) { MessageBox.Show("Brio مفتوح بالفعل. افتح نافذته من شريط المهام.", "Brio LAN"); return; }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new BrioLauncher());
        }
    }
    BrioLauncher() {
        InitializeWindow();
        health.Interval = 1500; health.Tick += async (s,e) => await CheckHealth();
        FormClosing += async (s,e) => {
            if (server == null || server.HasExited) return;
            e.Cancel = true;
            if (stopping) return;
            if (MessageBox.Show("إغلاق التطبيق يوقف اللعبة لجميع المشاركين. هل تريد المتابعة؟", "Brio LAN", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            await StopServer(false); if (server == null || server.HasExited) Close();
        };
    }
    void Append(string line) {
        if (String.IsNullOrEmpty(line) || IsDisposed || !IsHandleCreated) return;
        BeginInvoke((Action)(() => { if (details.TextLength > 12000) details.Clear(); details.AppendText(line + Environment.NewLine); }));
    }
    void StartServer() {
        if (server != null && !server.HasExited) return;
        try {
            Directory.CreateDirectory(data); details.Clear();
            var info = new ProcessStartInfo(Path.Combine(root, "runtime", "node.exe"), "\"" + Path.Combine(root, "runtime", "server.mjs") + "\"") {
                UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = root,
                RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true
            };
            info.EnvironmentVariables["BRIO_LAN_ROOT"] = root;
            info.EnvironmentVariables["BRIO_LAN_DATA"] = data;
            info.EnvironmentVariables["BRIO_LAN_PORT"] = port;
            info.EnvironmentVariables["BRIO_LAN_DESKTOP"] = "1";
            server = new Process { StartInfo = info, EnableRaisingEvents = true };
            server.OutputDataReceived += (s,e) => Append(e.Data); server.ErrorDataReceived += (s,e) => Append(e.Data);
            server.Start(); server.BeginOutputReadLine(); server.BeginErrorReadLine();
            ShowState(LauncherState.Starting, null); health.Start();
        } catch (Exception error) { if (server != null) server.Dispose(); server = null; ShowState(LauncherState.Error, "راجع تفاصيل التشغيل ثم أعد المحاولة."); Append(error.Message); }
    }
    async Task CheckHealth() {
        health.Stop();
        var current = server;
        if (current == null || current.HasExited) {
            ShowState(LauncherState.Error, "توقف الخادم. راجع التفاصيل أو أعد التشغيل."); return;
        }
        try {
            bool ready = await Task.Run(() => {
                var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/health");
                request.Timeout = 1000;
                request.Proxy = null;
                using (var response = request.GetResponse()) using (var reader = new StreamReader(response.GetResponseStream()))
                    return reader.ReadToEnd().Contains("\"lan\"");
            });
            if (server != current || stopping || IsDisposed) return;
            if (ready && !current.HasExited) { ShowState(LauncherState.Running, null); }
        } catch { }
        if (!stopping && server == current && !IsDisposed) health.Start();
    }
    void OpenBrowser() { if (open.Enabled) Process.Start(new ProcessStartInfo("http://localhost:" + port + "/local/") { UseShellExecute = true }); }
    void OpenDataFolder() { Directory.CreateDirectory(data); Process.Start("explorer.exe", data); }
    async Task StopServer(bool confirm) {
        if (stopping || server == null || server.HasExited) return;
        if (confirm && MessageBox.Show("سيتم قطع اتصال جميع اللاعبين. تُحفظ البيانات على هذا الجهاز. إيقاف اللعبة؟", "Brio LAN", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
        stopping = true; health.Stop(); ShowState(LauncherState.Stopping, null);
        try {
            server.StandardInput.WriteLine("stop"); server.StandardInput.Flush();
            bool exited = await Task.Run(() => server.WaitForExit(8000));
            if (!exited) { ShowState(LauncherState.Error, "تعذّر الإيقاف الآمن. انتظر ثم أعد المحاولة."); start.Enabled = false; stop.Enabled = true; return; }
            server.Dispose(); server = null; ShowState(LauncherState.Idle, "بياناتك محفوظة. يمكنك تشغيل لعبة جديدة في أي وقت.");
        } catch (Exception error) { Append(error.Message); start.Enabled = server == null || server.HasExited; }
        finally { stopping = false; }
    }
}
