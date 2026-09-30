using System.ComponentModel.DataAnnotations;

namespace Brio.Business.Forms.AuthForms;

public class GoogleAuthForm
{
    [Required(ErrorMessage = "Google ID token is required.")]
    public string IdToken { get; set; } = string.Empty;
}
