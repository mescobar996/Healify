'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const TOOLS = [
  {
    name: 'Playwright',
    description: 'Modern E2E testing framework by Microsoft.',
    logo: 'https://playwright.dev/img/playwright-logo.svg',
    url: 'https://playwright.dev',
  },
  {
    name: 'Cypress',
    description: 'Fast, reliable testing for anything in a browser.',
    logo: 'https://raw.githubusercontent.com/cypress-io/cypress/develop/assets/cypress-logo-dark.png',
    url: 'https://cypress.io',
  },
  {
    name: 'Jest',
    description: 'Delightful JavaScript testing with simplicity.',
    logo: 'https://raw.githubusercontent.com/facebook/jest/main/website/static/img/jest.png',
    url: 'https://jestjs.io',
  },
  {
    name: 'Selenium',
    description: 'Browser automation for web applications.',
    logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/selenium/selenium-original.svg',
    url: 'https://selenium.dev',
  },
  {
    name: 'GitHub Actions',
    description: 'Automate CI/CD right from your repo.',
    logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/githubactions/githubactions-original.svg',
    url: 'https://github.com/features/actions',
  },
  {
    name: 'TypeScript',
    description: 'Typed JavaScript at any scale.',
    logo: 'https://raw.githubusercontent.com/remojansen/logo.ts/master/ts.png',
    url: 'https://typescriptlang.org',
  },
  {
    name: 'Python',
    description: 'Popular language for test automation.',
    logo: 'https://raw.githubusercontent.com/github/explore/main/topics/python/python.png',
    url: 'https://python.org',
  },
  {
    name: 'GitHub',
    description: 'Code hosting and collaboration platform.',
    logo: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    url: 'https://github.com',
  },
]

export default function CompatibleToolsSection() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#EDEDED] mb-3 font-heading">
            Compatible Tools
          </h2>
          <p className="text-base text-[#EDEDED]/50 max-w-xl mx-auto">
            Healify integrates seamlessly with your existing testing stack
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {TOOLS.map((tool, i) => (
            <motion.a
              key={tool.name}
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className={cn(
                'group glass-elite glass-elite-hover p-5 sm:p-6 rounded-2xl',
                'flex flex-col items-center text-center gap-4',
                'hover:scale-[1.03] transition-transform duration-200'
              )}
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/15 group-hover:border-white/30 transition-colors">
                <Image
                  src={tool.logo}
                  alt={tool.name}
                  width={36}
                  height={36}
                  className="object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                  unoptimized
                />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-[#EDEDED] mb-1">
                  {tool.name}
                </h3>
                <p className="text-[11px] sm:text-xs text-[#EDEDED]/40 leading-relaxed">
                  {tool.description}
                </p>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  )
}
