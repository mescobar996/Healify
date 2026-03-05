'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

const TOOLS = [
  {
    name: 'Playwright',
    logo: 'https://playwright.dev/img/playwright-logo.svg',
    url: 'https://playwright.dev',
  },
  {
    name: 'Cypress',
    logo: 'https://raw.githubusercontent.com/cypress-io/cypress/develop/assets/cypress-logo-dark.png',
    url: 'https://cypress.io',
  },
  {
    name: 'Jest',
    logo: 'https://raw.githubusercontent.com/facebook/jest/main/website/static/img/jest.png',
    url: 'https://jestjs.io',
  },
  {
    name: 'Selenium',
    logo: 'https://raw.githubusercontent.com/SeleniumHQ/seleniumhq.github.io/trunk/images/selenium_logo_square_green.png',
    url: 'https://selenium.dev',
  },
  {
    name: 'GitHub Actions',
    logo: 'https://github.githubassets.com/images/modules/site/features/actions-icon-actions.svg',
    url: 'https://github.com/features/actions',
  },
  {
    name: 'TypeScript',
    logo: 'https://raw.githubusercontent.com/remojansen/logo.ts/master/ts.png',
    url: 'https://typescriptlang.org',
  },
  {
    name: 'Python',
    logo: 'https://raw.githubusercontent.com/github/explore/main/topics/python/python.png',
    url: 'https://python.org',
  },
  {
    name: 'GitHub',
    logo: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    url: 'https://github.com',
  },
]

export default function CompatibleToolsSection() {
  return (
    <section className="relative py-16 sm:py-20 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-[11px] font-medium tracking-[0.2em] text-[#EDEDED]/40 uppercase mb-10"
        >
          Compatible con tus herramientas favoritas
        </motion.p>

        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {TOOLS.map((tool, i) => (
            <motion.a
              key={tool.name}
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group flex flex-col items-center gap-2.5 px-4 py-3 rounded-xl hover:bg-white/[0.04] transition-all duration-200"
            >
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08] group-hover:border-white/20 group-hover:bg-white/[0.1] transition-all duration-200">
                <Image
                  src={tool.logo}
                  alt={tool.name}
                  width={28}
                  height={28}
                  className="object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-200"
                  unoptimized
                />
              </div>
              <span className="text-[11px] font-medium text-[#EDEDED]/40 group-hover:text-[#EDEDED]/70 transition-colors duration-200">
                {tool.name}
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  )
}
