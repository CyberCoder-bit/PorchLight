# PorchLight: Project Narrative

**Team:** Jason Xu and William Geng · **School:** Carmel High School · **Grades 9-12**

## Market research: how we found the challenge and came up with the idea

We noticed that our own grandparents were often isolated, so we looked at the research. Indiana's
65+ population grew 40% from 2010 to 2023, and Hamilton County, our first community, is projected to
more than double its senior population between 2020 and 2050 [1]. In Central Indiana, more than
one-third of older adults (55+) live alone, and one in three report loneliness or social isolation
[2]. Lacking social connection is as dangerous as smoking up to 15 cigarettes a day [3], and in older
adults isolation is linked to a 50% higher risk of dementia [4]. Language can be a barrier too:
161,812 Hoosiers who speak Spanish at home speak English less than "very well" [5], and by 2020
almost 20,000 Burmese refugees, most of them Chin, had been placed in Indianapolis [6].

Hamilton County already has CICOA, its Area Agency on Aging [7], the Shepherd's Center, which
matches volunteers with isolated seniors [8], and Indiana 211 [9]. Their public pages don't describe
a way for families to see whether contact is happening, or help for volunteers, often teenagers,
with what to say. Those two gaps became PorchLight. Our full market research, with the exact wording
from every source, is in our
[research document](https://github.com/CyberCoder-bit/PorchLight/blob/main/docs/research.md).

## How PorchLight solves the challenge

A coordinator matches each senior with a volunteer who shares their interests, free time, and a
language. Before every call, PorchLight offers three conversation starters ("sparks"). A family
dashboard flags a senior who goes too long without contact, or whose check-ins fall by half.
Seniors, volunteers, and family members sign up for themselves, and a coordinator approves new
volunteers and family links.

In our Carmel demo, 88-year-old "Hal" had a volunteer who visited twice a week until basketball
season. PorchLight counts only visits that happened, so after 12 quiet days it flags "Isolation
risk" and "Contact dropping," and the coordinator's list suggests checking on yesterday's visit.
Hal's son sees his dad's card and a weekly summary, never call notes. Samira, 76, reads Arabic, so
her pages are in Arabic, right to left. Her volunteer, Jordan, speaks only English. Both turned on
translate help, so each reads the other's messages in their own language.

## How technology was used

PorchLight is a Node.js web app with no required dependencies that also runs on Cloudflare Workers.
Pages are built on the server and work without JavaScript, and every page we measured scored 100 on
Lighthouse's accessibility audit. Passwords are hashed with PBKDF2, and one table of rules, checked
on the server before every request, decides who may open each page. Matching uses plain rules a
coordinator can explain (shared language, interests, and free time). Indiana has two time zones
[10], so each deployment serves one. More than 300 automated tests check the rules and every page,
and we tested it by hand on computers and phones.

## Why and how AI was used

In the product: before each call, Gemini (Google's AI model) can write three starters from the
senior's first name, interests, "about me" text, and days since the last call. It can also
translate messages between a matched pair, after telling them their words will be sent. If Gemini
is busy, a backup AI on Cloudflare Workers AI answers instead, and with no AI at all, built-in
starters and pre-written translations take over. Both AI services run on free tiers, so the
prototype costs nothing to run. Family contacts and call notes are never sent, and AI stays out of
matching, risk flags, and access.

In building it: we used AI as practice judges. We gave it the competition rubric, had it score
PorchLight and our drafts the way a real judge would, and used its feedback to improve the app and
this submission.

## Team member roles

Jason Xu and William Geng are co-developers who shared the research, design, coding, and testing.
**Jason** focused more on volunteering, and **William** focused more on language and accessibility.

### Sources

1. IBRC, "Projections show significant growth for Indiana's elderly population," 2024. incontext.indiana.edu
2. Polis Center at IU Indianapolis, *State of Aging in Central Indiana*, 2023. ipbs.org
3. U.S. Surgeon General, *Our Epidemic of Loneliness and Isolation*, 2023. hhs.gov
4. CDC, "Loneliness Puts Older Adults at Risk," 2020. tools.cdc.gov
5. U.S. Census Bureau, American Community Survey 2024, table B16001. data.census.gov
6. *Encyclopedia of Indianapolis*, "Burmese," 2021. indyencyclopedia.org
7. Indiana FSSA, "Area Agencies on Aging." in.gov/fssa
8. Shepherd's Center of Hamilton County, "Community Caring."
9. Indiana FSSA, "Indiana 211." in.gov/fssa/indiana-211
10. State of Indiana, "Indiana Time Zone Information." faqs.in.gov

## Try it and see the code

- **Live app:** https://porchlight.world168158.workers.dev ("Try a demo account"; no password)
- **Source code:** https://github.com/CyberCoder-bit/PorchLight (setup in the README;
  [architecture diagram](https://github.com/CyberCoder-bit/PorchLight/blob/main/docs/architecture-diagram.md))
