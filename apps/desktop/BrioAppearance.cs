using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

// Shared native styling; application state and install/server behavior stay in their controllers.
static class BrioAppearance {
    public static void Round(Control control, int radius) {
        EventHandler resize = (s,e) => {
            if (control.Width < radius * 2 || control.Height < radius * 2) return;
            using (var path = Outline(new Rectangle(0,0,control.Width,control.Height),radius)) {
                var old = control.Region; control.Region = new Region(path); if (old != null) old.Dispose();
            }
        };
        control.Resize += resize; resize(control,EventArgs.Empty);
    }
    public static GraphicsPath Outline(Rectangle bounds,int radius) {
        int d=radius*2; var path=new GraphicsPath();
        path.AddArc(bounds.Left,bounds.Top,d,d,180,90);
        path.AddArc(bounds.Right-d,bounds.Top,d,d,270,90);
        path.AddArc(bounds.Right-d,bounds.Bottom-d,d,d,0,90);
        path.AddArc(bounds.Left,bounds.Bottom-d,d,d,90,90); path.CloseFigure(); return path;
    }
}

class BrioButton : Button {
    protected override void OnPaint(PaintEventArgs e) {
        e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;
        e.Graphics.Clear(Parent==null?SystemColors.Control:Parent.BackColor);
        var bounds=new Rectangle(1,1,Width-3,Height-3);
        var background=Enabled?BackColor:Color.FromArgb(237,240,245);
        using(var shape=BrioAppearance.Outline(bounds,10))
        using(var fill=new SolidBrush(background))
        using(var border=new Pen(FlatAppearance.BorderSize==0?background:FlatAppearance.BorderColor)) {
            e.Graphics.FillPath(fill,shape); e.Graphics.DrawPath(border,shape);
        }
        TextRenderer.DrawText(e.Graphics,Text,Font,bounds,Enabled?ForeColor:Color.FromArgb(145,153,167),
            TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.RightToLeft|TextFormatFlags.EndEllipsis);
        if(Focused&&ShowFocusCues) ControlPaint.DrawFocusRectangle(e.Graphics,Rectangle.Inflate(bounds,-5,-5));
    }
}
