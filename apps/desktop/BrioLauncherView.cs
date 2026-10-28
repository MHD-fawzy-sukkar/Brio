using System;
using System.Drawing;
using System.Reflection;
using System.Windows.Forms;

internal enum LauncherState { Idle, Starting, Running, Stopping, Error }

partial class BrioLauncher {
    readonly Label statusTitle = new Label();
    readonly Label statusHint = new Label();
    readonly Panel statusCard = new Panel();
    readonly Button toggleDetails = new Button();
    readonly TableLayoutPanel layout = new TableLayoutPanel();
    PictureBox logo;

    void InitializeWindow() {
        Text = "Brio LAN · 0.1.2";
        ClientSize = new Size(720, 540); MinimumSize = new Size(690, 580);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(246, 247, 251);
        Font = new Font("Segoe UI", 10.5f);
        AutoScaleMode = AutoScaleMode.Font;
        RightToLeft = RightToLeft.Yes; RightToLeftLayout = false;
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Brio.Icon"))
            if (stream != null) Icon = new Icon(stream);
        layout.Dock = DockStyle.Fill; layout.Padding = new Padding(26);
        layout.ColumnCount = 1; layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.RowCount = 6; layout.RightToLeft = RightToLeft.No;
        foreach (int height in new[] { 104, 102, 72, 112, 44, 0 }) layout.RowStyles.Add(new RowStyle(SizeType.Absolute, height));
        Controls.Add(layout);
        BuildHeader(); BuildStatus(); BuildActions(); BuildGuide(); BuildFooter(); BuildDetails();
        ShowState(LauncherState.Idle, null);
    }

    Label TextLabel(string text, float size, Color color, bool bold) {
        // WinForms mirrors horizontal label alignment when RightToLeft is Yes.
        return new Label { Text = text, Dock = DockStyle.Fill, AutoSize = false,
            Font = new Font("Segoe UI", size, bold ? FontStyle.Bold : FontStyle.Regular),
            ForeColor = color, RightToLeft = RightToLeft.Yes, TextAlign = ContentAlignment.MiddleLeft,
            UseCompatibleTextRendering = false };
    }
    void BuildHeader() {
        var header = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, Margin = new Padding(0,0,0,14) };
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100)); header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,96));
        var text = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 2, ColumnCount = 1 };
        text.RowStyles.Add(new RowStyle(SizeType.Absolute,43)); text.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        text.Controls.Add(TextLabel("Brio · اللعب المحلي",22,Color.FromArgb(24,32,49),true),0,0);
        text.Controls.Add(TextLabel("مسابقتك على اللابتوب. والمشاركون على هواتفهم.",10.5f,Color.FromArgb(102,114,135),false),0,1);
        logo = new PictureBox { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom, Margin = new Padding(12,0,0,0), AccessibleName = "شخصية Brio" };
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Brio.Logo"))
            if (stream != null) using (var image = Image.FromStream(stream)) logo.Image = new Bitmap(image);
        header.Controls.Add(text,0,0); header.Controls.Add(logo,1,0); layout.Controls.Add(header,0,0);
    }
    void BuildStatus() {
        statusCard.Dock = DockStyle.Fill; statusCard.Padding = new Padding(18,10,18,10); statusCard.Margin = new Padding(0,0,0,10);
        BrioAppearance.Round(statusCard,14);
        var text = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 2, ColumnCount = 1, BackColor = Color.Transparent };
        text.RowStyles.Add(new RowStyle(SizeType.Absolute,34)); text.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        statusTitle.Dock = statusHint.Dock = DockStyle.Fill;
        statusTitle.Font = new Font("Segoe UI",14,FontStyle.Bold); statusHint.Font = new Font("Segoe UI",10);
        statusTitle.TextAlign = statusHint.TextAlign = ContentAlignment.MiddleLeft;
        statusTitle.RightToLeft = statusHint.RightToLeft = RightToLeft.Yes;
        text.Controls.Add(statusTitle,0,0); text.Controls.Add(statusHint,0,1); statusCard.Controls.Add(text); layout.Controls.Add(statusCard,0,1);
    }
    void BuildActions() {
        var actions = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1, Margin = new Padding(0,4,0,14), RightToLeft = RightToLeft.No };
        for(int i=0;i<3;i++) actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100f/3));
        StyleButton(start,"تشغيل اللعبة"); StyleButton(open,"فتح لوحة المقدّم"); StyleButton(stop,"إيقاف اللعبة");
        start.Click += (s,e) => StartServer(); open.Click += (s,e) => OpenBrowser(); stop.Click += async (s,e) => await StopServer(true);
        // Explicit geometry: the first action is on the right in this Arabic window.
        actions.Controls.Add(stop,0,0); actions.Controls.Add(open,1,0); actions.Controls.Add(start,2,0); layout.Controls.Add(actions,0,2);
        start.TabIndex=0; open.TabIndex=1; stop.TabIndex=2;
    }
    void StyleButton(Button button,string text) {
        button.Text=text; button.Dock=DockStyle.Fill; button.Margin=new Padding(4,0,4,0);
        button.FlatStyle=FlatStyle.Flat; button.FlatAppearance.BorderColor=Color.FromArgb(216,222,231);
        button.FlatAppearance.BorderSize=1; button.BackColor=Color.White; button.ForeColor=Color.FromArgb(62,74,92);
        button.Font=new Font("Segoe UI",10.5f,FontStyle.Bold); button.Cursor=Cursors.Hand;
        button.RightToLeft=RightToLeft.Yes; button.UseVisualStyleBackColor=false;
    }
    void Emphasize(Button button,bool primary) {
        button.BackColor=primary ? Color.FromArgb(166,44,67) : Color.White;
        button.ForeColor=primary ? Color.White : Color.FromArgb(62,74,92);
        button.FlatAppearance.BorderColor=primary ? Color.FromArgb(166,44,67) : Color.FromArgb(216,222,231);
    }
    void BuildGuide() {
        var guide = new TableLayoutPanel { Dock=DockStyle.Fill, ColumnCount=1, RowCount=3, Padding=new Padding(14,8,14,8), BackColor=Color.White, Margin=new Padding(0,0,0,8) };
        foreach(string line in new[] { "١   شغّل اللعبة، ثم افتح لوحة المقدّم واستورد مسابقتك.", "٢   صِل الهواتف بالشبكة نفسها وشارك QR من غرفة اللعبة.", "٣   أبقِ التطبيق واللابتوب يعملان حتى انتهاء المسابقة." })
            guide.Controls.Add(TextLabel(line,10,Color.FromArgb(87,101,122),false));
        for(int i=0;i<3;i++) guide.RowStyles.Add(new RowStyle(SizeType.Percent,100f/3));
        layout.Controls.Add(guide,0,3);
        BrioAppearance.Round(guide,14);
    }
    void BuildFooter() {
        var footer = new TableLayoutPanel { Dock=DockStyle.Fill, ColumnCount=2, RowCount=1, Margin=new Padding(0), RightToLeft=RightToLeft.No };
        footer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50)); footer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));
        var files=new Button(); StyleButton(files,"مجلد المسابقات والنتائج"); files.Font=new Font("Segoe UI",9); files.FlatAppearance.BorderSize=0; files.BackColor=BackColor;
        files.Click+=(s,e)=>OpenDataFolder();
        StyleButton(toggleDetails,"تفاصيل التشغيل"); toggleDetails.Font=new Font("Segoe UI",9); toggleDetails.FlatAppearance.BorderSize=0; toggleDetails.BackColor=BackColor;
        toggleDetails.Click+=(s,e)=>ToggleDetails(); footer.Controls.Add(toggleDetails,0,0); footer.Controls.Add(files,1,0); layout.Controls.Add(footer,0,4);
    }
    void BuildDetails() {
        details.Multiline=true; details.ReadOnly=true; details.ScrollBars=ScrollBars.Vertical;
        details.Dock=DockStyle.Fill; details.RightToLeft=RightToLeft.No; details.Visible=false;
        details.Font=new Font("Consolas",9); details.BackColor=Color.White; details.ForeColor=Color.FromArgb(70,81,99);
        details.BorderStyle=BorderStyle.FixedSingle; details.AccessibleName="سجل التشغيل";
        layout.Controls.Add(details,0,5);
    }
    void ToggleDetails() {
        bool expanded=!details.Visible;
        details.Visible=expanded; layout.RowStyles[5].Height=expanded?130:0;
        ClientSize=new Size(ClientSize.Width,expanded?670:540);
        toggleDetails.Text=expanded?"إخفاء التفاصيل":"تفاصيل التشغيل";
    }
    internal void ShowState(LauncherState state,string message) {
        bool running=state==LauncherState.Running, error=state==LauncherState.Error;
        start.Enabled=state==LauncherState.Idle||error; open.Enabled=running;
        stop.Enabled=running||state==LauncherState.Starting;
        statusCard.BackColor=running?Color.FromArgb(233,246,240):error?Color.FromArgb(255,239,237):Color.FromArgb(237,240,247);
        statusTitle.ForeColor=running?Color.FromArgb(29,114,77):error?Color.FromArgb(166,44,67):Color.FromArgb(54,68,91);
        statusHint.ForeColor=Color.FromArgb(87,101,122);
        statusTitle.Text=running?"●  اللعبة جاهزة للمشاركين":state==LauncherState.Starting?"جاري تشغيل اللعبة…":state==LauncherState.Stopping?"جاري إيقاف اللعبة…":error?"تعذّر تشغيل اللعبة":"اللعبة متوقفة";
        statusHint.Text=message??(running?"افتح لوحة المقدّم لإنشاء غرفة ومشاركة رمز QR.":state==LauncherState.Starting?"لحظات، نجهّز لوحة المقدّم على هذا الجهاز.":state==LauncherState.Stopping?"نغلق الاتصالات بأمان. بياناتك تبقى محفوظة.":"اضغط «تشغيل اللعبة» للبدء. لا تحتاج إلى الإنترنت أثناء اللعب.");
        Emphasize(start,!running&&state!=LauncherState.Stopping); Emphasize(open,running); Emphasize(stop,false);
    }
    protected override void Dispose(bool disposing) {
        if(disposing) { if(logo!=null&&logo.Image!=null)logo.Image.Dispose(); health.Dispose(); }
        base.Dispose(disposing);
    }
}

