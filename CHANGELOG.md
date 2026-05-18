# Changelog

Este projeto usa Git tags como fonte de verdade para changelogs.

## Como ler mudancas

- Mudancas ainda nao tagueadas ficam no intervalo entre `HEAD` e a ultima tag.
- Mudancas publicadas devem estar associadas a uma tag anotada no formato `vX.Y.Z`.
- Release notes devem ser geradas a partir dos commits entre duas tags.

## Convencao de tags

- `v0.1.0`: primeira versao funcional ou marco de MVP.
- `v0.1.1`: correcoes pequenas sem mudanca de contrato.
- `v0.2.0`: nova fatia funcional relevante.
- `v1.0.0`: primeiro release considerado estavel.

Use tags anotadas:

```powershell
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

## Gerar changelog local

Primeira tag:

```powershell
git log --oneline --decorate
```

Entre tags:

```powershell
git log --oneline v0.1.0..v0.2.0
```

Mudancas desde a ultima tag:

```powershell
git describe --tags --abbrev=0
git log --oneline $(git describe --tags --abbrev=0)..HEAD
```

## Formato sugerido de release notes

```text
## vX.Y.Z

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Notes
- ...
```
