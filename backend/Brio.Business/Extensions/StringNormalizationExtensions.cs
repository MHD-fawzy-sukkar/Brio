using System.Text;

namespace Brio.Business.Extensions;

public static class StringNormalizationExtensions
{
    /// <summary>
    /// Normalizes a string for fast, consistent short answer validation.
    /// Trims leading/trailing spaces, collapses multiple internal spaces, converts to lowercase,
    /// and normalizes Arabic diacritical marks and letter variants (أ,إ,آ -> ا; ة -> ه; ى -> ي).
    /// </summary>
    public static string NormalizeShortAnswer(this string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        string trimmed = input.Trim().ToLowerInvariant();

        var sb = new StringBuilder(trimmed.Length);
        bool previousWasSpace = false;

        foreach (char c in trimmed)
        {
            // Normalize Arabic character variants
            char normalizedChar = c switch
            {
                'أ' or 'إ' or 'آ' => 'ا',
                'ة' => 'ه',
                'ى' => 'ي',
                _ => c
            };

            // Remove Arabic Tashkeel (diacritics: Fatha, Damma, Kasra, Sukun, Shadda, Tanwin)
            if (IsArabicDiacritic(normalizedChar))
            {
                continue;
            }

            // Collapse multiple spaces into single space
            if (char.IsWhiteSpace(normalizedChar))
            {
                if (!previousWasSpace)
                {
                    sb.Append(' ');
                    previousWasSpace = true;
                }
            }
            else
            {
                sb.Append(normalizedChar);
                previousWasSpace = false;
            }
        }

        return sb.ToString().Trim();
    }

    private static bool IsArabicDiacritic(char c)
    {
        // Harakat ranges: U+064B to U+0652, U+0670
        return (c >= '\u064B' && c <= '\u0652') || c == '\u0670';
    }
}
