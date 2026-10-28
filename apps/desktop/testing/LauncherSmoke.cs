using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;

// Compile with /main:LauncherSmoke beside a prepared runtime. No installer/registry changes.
class LauncherSmoke {
    static Exception failure;
    [STAThread] static int Main(string[] args) {
        Environment.SetEnvironmentVariable("BRIO_DESKTOP_DATA", args[0]);
        Environment.SetEnvironmentVariable("BRIO_DESKTOP_PORT", "3301");
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        using(var form=(BrioLauncher)Activator.CreateInstance(typeof(BrioLauncher),true)) {
            form.ShowInTaskbar=false; form.Opacity=0;
            form.Shown+=async(s,e)=>{
                try {
                    Button start=Find(form,"تشغيل اللعبة"), open=Find(form,"فتح لوحة المقدّم");
                    Assert(start.Enabled&&!open.Enabled,"Idle buttons");
                    Assert(Descendants(form).OfType<PictureBox>().Any(p=>p.Image!=null),"Brio image");
                    start.PerformClick();
                    for(int i=0;i<100&&!open.Enabled;i++) await Task.Delay(150);
                    Assert(open.Enabled&&!start.Enabled,"Ready buttons after actual server start");
                    Assert(Descendants(form).OfType<Label>().Any(l=>l.Text.Contains("جاهزة للمشاركين")),"Ready status");
                    var content=form.Controls[0];
                    using(var image=new Bitmap(content.Width,content.Height)) { content.DrawToBitmap(image,new Rectangle(Point.Empty,content.Size));image.Save(args[1]); }
                    var stop=typeof(BrioLauncher).GetMethod("StopServer",BindingFlags.NonPublic|BindingFlags.Instance);
                    await (Task)stop.Invoke(form,new object[]{false});
                    await Task.Delay(1800); // A late health response must not revive the running state.
                    Assert(start.Enabled&&!open.Enabled,"Idle buttons after graceful stop");
                    Find(form,"تفاصيل التشغيل").PerformClick();
                    Assert(Descendants(form).OfType<TextBox>().Single().Visible,"Expandable log");
                    Find(form,"إخفاء التفاصيل").PerformClick();
                    Assert(!Descendants(form).OfType<TextBox>().Single().Visible,"Collapsed log");
                    Console.WriteLine("PASS: real server ready, logo, button priority, graceful stop, late-health guard, log toggle");
                } catch(Exception error) {
                    failure=error;
                }
                if(failure!=null) {
                    try { await (Task)typeof(BrioLauncher).GetMethod("StopServer",BindingFlags.NonPublic|BindingFlags.Instance).Invoke(form,new object[]{false}); } catch { }
                }
                form.Close();
            };
            Application.Run(form);
        }
        if(failure!=null) {Console.Error.WriteLine(failure);return 1;} return 0;
    }
    static Button Find(Control control,string text) {return Descendants(control).OfType<Button>().Single(b=>b.Text==text);}
    static System.Collections.Generic.IEnumerable<Control> Descendants(Control parent) {
        foreach(Control child in parent.Controls) {yield return child;foreach(var nested in Descendants(child))yield return nested;}
    }
    static void Assert(bool value,string label) {if(!value)throw new Exception(label);}
}
