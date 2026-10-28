using System;
using System.Drawing;
using System.Reflection;
using System.Windows.Forms;

partial class BrioSetup {
    readonly ProgressBar progress = new ProgressBar();
    PictureBox logo;

    void InitializeWindow() {
        Text = "تثبيت Brio LAN · 0.1.2";
        ClientSize = new Size(640, 472); FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        AutoScaleDimensions = new SizeF(96,96); AutoScaleMode = AutoScaleMode.Dpi;
        Font = new Font("Segoe UI", 10.5f);
        BackColor = Color.FromArgb(246,247,251); RightToLeft = RightToLeft.Yes;
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Brio.Icon"))
            if (stream != null) Icon = new Icon(stream);
        var layout = new TableLayoutPanel {
            Dock = DockStyle.Fill, Padding = new Padding(28), ColumnCount = 1,
            RowCount = 6, RightToLeft = RightToLeft.No
        };
        foreach (int height in new[] {104,148,62,22,58,22})
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute,height));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100)); Controls.Add(layout);
        var header = new TableLayoutPanel { Dock=DockStyle.Fill, ColumnCount=2, RowCount=1, Margin=new Padding(0,0,0,16) };
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,100));
        var titles = new TableLayoutPanel { Dock=DockStyle.Fill, ColumnCount=1, RowCount=2 };
        titles.RowStyles.Add(new RowStyle(SizeType.Absolute,44));
        titles.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        titles.Controls.Add(Copy("أهلاً بك في Brio",22,true),0,0);
        titles.Controls.Add(Copy("جهّز اللابتوب لمسابقات على الشبكة المحلية.",10.5f,false),0,1);
        logo = new PictureBox { Dock=DockStyle.Fill, SizeMode=PictureBoxSizeMode.Zoom, AccessibleName="شخصية Brio" };
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Brio.Logo"))
            if (stream != null) using (var image=Image.FromStream(stream)) logo.Image=new Bitmap(image);
        header.Controls.Add(titles,0,0); header.Controls.Add(logo,1,0); layout.Controls.Add(header,0,0);
        var guide = new TableLayoutPanel {
            Dock=DockStyle.Fill, Padding=new Padding(18,10,18,10), Margin=new Padding(0,0,0,12),
            BackColor=Color.White, ColumnCount=1, RowCount=3
        };
        foreach (string line in new[] {
            "١   ثبّت التطبيق؛ يُضاف اختصار على سطح المكتب.",
            "٢   شغّل اللعبة وافتح لوحة المقدّم لإضافة مسابقتك.",
            "٣   ينضم اللاعبون عبر QR من هواتفهم على الشبكة نفسها."
        }) {
            guide.RowStyles.Add(new RowStyle(SizeType.Percent,100f/3)); guide.Controls.Add(Copy(line,10.5f,false));
        }
        layout.Controls.Add(guide,0,1);
        BrioAppearance.Round(guide,14);
        status.Dock=DockStyle.Fill; status.Text="جاهز للتثبيت على حسابك. مسابقاتك ونتائجك تبقى محفوظة عند التحديث.";
        status.ForeColor=Color.FromArgb(87,101,122); status.RightToLeft=RightToLeft.Yes;
        status.TextAlign=ContentAlignment.MiddleLeft; layout.Controls.Add(status,0,2);
        progress.Dock=DockStyle.Fill; progress.Style=ProgressBarStyle.Continuous;
        progress.Margin=new Padding(0,2,0,10); layout.Controls.Add(progress,0,3);
        install.Text="تثبيت وفتح Brio"; install.Dock=DockStyle.Fill; install.Margin=new Padding(0,6,0,4);
        install.FlatStyle=FlatStyle.Flat; install.FlatAppearance.BorderSize=0;
        install.BackColor=Color.FromArgb(166,44,67); install.ForeColor=Color.White;
        install.Font=new Font("Segoe UI",12,FontStyle.Bold); install.Cursor=Cursors.Hand;
        install.UseVisualStyleBackColor=false; layout.Controls.Add(install,0,4);
        var version=Copy("Windows 10 / 11 · x64 · الإصدار التجريبي 0.1.2",9,false);
        layout.Controls.Add(version,0,5);
    }
    static Label Copy(string text,float size,bool bold) {
        // RTL labels mirror alignment: MiddleLeft keeps Arabic copy against the right edge.
        return new Label {
            Text=text, Dock=DockStyle.Fill, RightToLeft=RightToLeft.Yes, TextAlign=ContentAlignment.MiddleLeft,
            Font=new Font("Segoe UI",size,bold?FontStyle.Bold:FontStyle.Regular),
            ForeColor=bold?Color.FromArgb(24,32,49):Color.FromArgb(87,101,122)
        };
    }
    protected override void Dispose(bool disposing) {
        if (disposing && logo != null && logo.Image != null) logo.Image.Dispose();
        base.Dispose(disposing);
    }
}
