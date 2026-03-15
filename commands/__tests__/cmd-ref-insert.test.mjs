import { convertRefInserts } from '../cmd-ref-insert.mjs'

describe('convert stats inserts', () => {
  it('should convert cmd into shortened stats html', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Костяная химера] /-->`)).toEqual(
      `
<section class="ref-insert ">
<header>Костяная химера</header>
<main>

<div class="no-page-break">
<div class="stats-insert">
<span class="stat-record"><span class="stat-name">Уровень</span>:&nbsp;<span class="stat-value">3</span></span>
<span class="stat-record"><span class="stat-name">HP</span>:&nbsp;<span class="stat-value">3d8 + 1 (16)</span></span>

</div>
</div>

Груды костей и останков поднимаются при осмотре: их опутал грибок, который заставляет их неуклюже двигаться и атаковать.
</main>
</section>
    `.trim(),
    )
  })

  xit('should convert cmd into shortened html (1st sentence)', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Костяная химера] /-->`)).toEqual(
      `
<div class="no-page-break">
<section class="ref-insert">
<header>Солнечный зайчик</header>
<main>Отсвет солнечного луча, преломленный стёклами купола, падает на лицо приключенца небольшим цветным пятном.</main>
</section>
</div>
    `.trim(),
    )
  })

  it('should convert cmd into full html', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Костяная химера] detailed /-->`)).toEqual(
      `
<section class="ref-insert ">
<header>Костяная химера</header>
<main>

<div class="no-page-break">
<div class="stats-insert">
<span class="stat-record"><span class="stat-name">Уровень</span>:&nbsp;<span class="stat-value">3</span></span>
<span class="stat-record"><span class="stat-name">HP</span>:&nbsp;<span class="stat-value">3d8 + 1 (16)</span></span>

</div>
</div>

Груды костей и останков поднимаются при осмотре: их опутал грибок, который заставляет их неуклюже двигаться и атаковать.

- _Когти или укус_: d6 (3) урона
</main>
</section>
    `.trim(),
    )
  })

  it('should ignore not found refs', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[XXX YYY] /-->`)).toEqual(`<!-- cmd[ref] header[XXX YYY] /-->`)
  })

  it('should insert n times', () => {
    expect(
      convertRefInserts(
        `XXX <!-- cmd[ref] header[Костяная химера] /--> YYY <!-- cmd[ref] header[Костяная химера] /-->`,
      ),
    ).toEqual(
      `
XXX <section class="ref-insert ">
<header>Костяная химера</header>
<main>

<div class="no-page-break">
<div class="stats-insert">
<span class="stat-record"><span class="stat-name">Уровень</span>:&nbsp;<span class="stat-value">3</span></span>
<span class="stat-record"><span class="stat-name">HP</span>:&nbsp;<span class="stat-value">3d8 + 1 (16)</span></span>

</div>
</div>

Груды костей и останков поднимаются при осмотре: их опутал грибок, который заставляет их неуклюже двигаться и атаковать.
</main>
</section> YYY <section class="ref-insert ">
<header>Костяная химера</header>
<main>

<div class="no-page-break">
<div class="stats-insert">
<span class="stat-record"><span class="stat-name">Уровень</span>:&nbsp;<span class="stat-value">3</span></span>
<span class="stat-record"><span class="stat-name">HP</span>:&nbsp;<span class="stat-value">3d8 + 1 (16)</span></span>

</div>
</div>

Груды костей и останков поднимаются при осмотре: их опутал грибок, который заставляет их неуклюже двигаться и атаковать.
</main>
</section>
    `.trim(),
    )
  })
})
