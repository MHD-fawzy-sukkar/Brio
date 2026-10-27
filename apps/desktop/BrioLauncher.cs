using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

class BrioLauncher : Form {
    Process server;
    readonly Label status = new Label();
    readonly Button start = new Button(), stop = new Button(), open = new Button();
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
        Text = "Brio LAN"; Size = new Size(660, 530); MinimumSize = new Size(600, 510);
        StartPosition = FormStartPosition.CenterScreen; BackColor = Color.FromArgb(248, 247, 252);
        Font = new Font("Segoe UI", 11); RightToLeft = RightToLeft.Yes; RightToLeftLayout = true;
        var panel = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(24), AutoScroll = true };
        Controls.Add(panel);
        panel.Controls.Add(new Label { Text = "Brio · اللعب على الشبكة المحلية", Width = 570, Height = 45, Font = new Font("Segoe UI", 19, FontStyle.Bold) });
        panel.Controls.Add(new Label { Text = "شغّل اللعبة على هذا الجهاز، ثم افتح لوحة المقدّم واستورد مسابقتك. الهواتف تنضم من رمز QR على شبكة Wi-Fi نفسها.", Width = 570, Height = 65 });
        status.Text = "متوقفة · اضغط تشغيل اللعبة"; status.Width = 570; status.Height = 35;
        status.ForeColor = Color.FromArgb(163, 42, 66); panel.Controls.Add(status);
        var buttons = new FlowLayoutPanel { Width = 575, Height = 58, FlowDirection = FlowDirection.RightToLeft };
        Configure(start, "تشغيل اللعبة", (s,e) => StartServer());
        Configure(open, "فتح لوحة المقدّم", (s,e) => OpenBrowser());
        Configure(stop, "إيقاف اللعبة", async (s,e) => await StopServer(true));
        buttons.Controls.Add(start); buttons.Controls.Add(open); buttons.Controls.Add(stop); panel.Controls.Add(buttons);
        panel.Controls.Add(new Label { Text = "أبقِ التطبيق والجهاز يعملان خلال المسابقة. لا تحتاج إلى الإنترنت بعد تنزيل المسابقة وصورها. استخدم شبكة خاصة موثوقة، واسمح للشبكة الخاصة فقط إذا طلب Windows Firewall ذلك.", Width = 570, Height = 80 });
        var files = new LinkLabel { Text = "فتح مجلد بياناتك والنتائج", Width = 570, Height = 28 };
        files.LinkClicked += (s,e) => { Directory.CreateDirectory(data); Process.Start("explorer.exe", data); }; panel.Controls.Add(files);
        details.Multiline = true; details.ReadOnly = true; details.ScrollBars = ScrollBars.Vertical;
        details.Width = 570; details.Height = 100; details.RightToLeft = RightToLeft.No; panel.Controls.Add(details);
        open.Enabled = stop.Enabled = false;
        health.Interval = 1500; health.Tick += async (s,e) => await CheckHealth();
        FormClosing += async (s,e) => {
            if (server == null || server.HasExited) return;
            e.Cancel = true;
            if (stopping) return;
            if (MessageBox.Show("إغلاق التطبيق يوقف اللعبة لجميع المشاركين. هل تريد المتابعة؟", "Brio LAN", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            await StopServer(false); if (server == null || server.HasExited) Close();
        };
    }
    void Configure(Button button, string text, EventHandler action) {
        button.Text = text; button.Width = 178; button.Height = 44; button.Click += action;
        button.BackColor = Color.White; button.FlatStyle = FlatStyle.Flat;
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
            start.Enabled = false; stop.Enabled = true; open.Enabled = false;
            status.Text = "جاري تشغيل اللعبة…"; health.Start();
        } catch (Exception error) { if (server != null) server.Dispose(); server = null; status.Text = "تعذّر التشغيل"; Append(error.Message); start.Enabled = true; }
    }
    async Task CheckHealth() {
        health.Stop();
        if (server == null || server.HasExited) {
            status.Text = "اللعبة متوقفة · راجع التفاصيل إذا تعذّر التشغيل";
            start.Enabled = true; open.Enabled = stop.Enabled = false; return;
        }
        try {
            bool ready = await Task.Run(() => {
                var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/health");
                request.Timeout = 1000;
                request.Proxy = null;
                using (var response = request.GetResponse()) using (var reader = new StreamReader(response.GetResponseStream()))
                    return reader.ReadToEnd().Contains("\"lan\"");
            });
            if (ready && !server.HasExited) { status.Text = "اللعبة تعمل · افتح لوحة المقدّم"; open.Enabled = true; }
        } catch { }
        if (!stopping) health.Start();
    }
    void OpenBrowser() { if (open.Enabled) Process.Start(new ProcessStartInfo("http://localhost:" + port + "/local/") { UseShellExecute = true }); }
    async Task StopServer(bool confirm) {
        if (stopping || server == null || server.HasExited) return;
        if (confirm && MessageBox.Show("سيتم قطع اتصال جميع اللاعبين. تُحفظ البيانات على هذا الجهاز. إيقاف اللعبة؟", "Brio LAN", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
        stopping = true; health.Stop(); start.Enabled = stop.Enabled = open.Enabled = false;
        status.Text = "جاري إيقاف اللعبة…";
        try {
            server.StandardInput.WriteLine("stop"); server.StandardInput.Flush();
            bool exited = await Task.Run(() => server.WaitForExit(8000));
            if (!exited) { status.Text = "تعذّر الإيقاف الآمن. انتظر ثم أعد المحاولة."; stop.Enabled = true; return; }
            server.Dispose(); server = null; status.Text = "اللعبة متوقفة · بياناتك محفوظة"; start.Enabled = true;
        } catch (Exception error) { Append(error.Message); start.Enabled = server == null || server.HasExited; }
        finally { stopping = false; }
    }
}
