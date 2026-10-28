# Windows distribution and SmartScreen

The user reported: "Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting." This is an application reputation warning. It is not a named malware detection and is not evidence that a file has passed independent malware review. The current Brio installer is an unsigned pilot.

Moving the same unsigned executable to Google Drive or GitHub Releases does not add a publisher signature or guarantee that SmartScreen stops warning. Keep a stable download location, but solve signing/distribution rather than asking users to disable protection. ZIP wrapping, filename changes, and self-signed certificates are not a production trust solution.

## Recommended public distribution

Package the presenter app as MSIX and submit it through Microsoft Store/Partner Center. Microsoft signs accepted Store MSIX packages after certification. This needs the owner's developer account/identity and Store review; it cannot be completed just by renaming EXE to MSIX. Validate the full-trust Win32/Node local-server behavior, private-network access, data location, update and uninstall behavior in the packaged app before submission.

The distinction matters: submitting the current EXE/MSI installer to the Store requires the publisher to sign that installer and its executable files first. Store MSIX distribution is the path where Microsoft handles package signing.

## Direct download alternative

Obtain a trusted code signing identity from an eligible provider. Azure Artifact Signing has country/entity eligibility restrictions; check those before enrolling or paying. Another option is a trusted CA-issued code signing certificate. Sign the presenter's executables/uninstaller and the final installer, timestamp the signatures, verify them, then regenerate the release checksum and publish. Protect signing credentials and keep a consistent publisher identity across versions.

A new signed app can still show a reputation warning initially. Signing verifies publisher identity and integrity; it is not an antivirus certificate or a guarantee against all warnings. EV certificates no longer provide an instant SmartScreen bypass. Do not buy EV merely for that purpose.

SignPath Foundation offers a possible free route for eligible open-source projects. It requires an appropriate open-source license and compliance with its release/build rules. Do not automatically relicense Brio or submit its files on the owner's behalf without explicit authorization.

## When to call it stable

Complete clean Windows install/update/uninstall testing, a physical Android/iOS local-network rehearsal with WAN disconnected, and real cloud login/upload/game verification. Resolve reproducible failures, establish a trusted release channel, and keep rollback/support instructions. "Stable" is a release decision backed by evidence; there is no switch that converts an unsigned pilot into an approved application.

## Primary sources checked 2026-10-28

- [SmartScreen reputation](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
- [Code signing options and MSIX versus EXE/MSI Store submissions](https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options)
- [SignPath Foundation eligibility](https://signpath.org/terms.html)
- [Microsoft developer guidance for actual false-positive malware detections](https://learn.microsoft.com/en-us/defender-xdr/developer-faq)
