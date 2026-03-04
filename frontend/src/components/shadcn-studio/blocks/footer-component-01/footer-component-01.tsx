import { FacebookIcon, InstagramIcon, TwitterIcon, YoutubeIcon } from 'lucide-react'

import { Separator } from '@/components/ui/separator'

import Logo from '@/components/shadcn-studio/logo'

const Footer = () => {
  return (
    <footer className='relative z-10 bg-[#050505] text-white/90'>
      <Separator className='bg-white/10' />

      <div className='mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 max-md:flex-col sm:px-6 sm:py-6 md:gap-6 md:py-8'>
        <a href='#'>
          <div className='flex items-center gap-3'>
            <Logo className='gap-3' />
          </div>
        </a>

        <div className='flex items-center gap-5 whitespace-nowrap text-sm'>
          <a href='#' className='text-white/60 transition-colors duration-300 hover:text-white'>
            About
          </a>
          <a href='#' className='text-white/60 transition-colors duration-300 hover:text-white'>
            Features
          </a>
          <a href='#' className='text-white/60 transition-colors duration-300 hover:text-white'>
            Docs
          </a>
          <a href='#' className='text-white/60 transition-colors duration-300 hover:text-white'>
            Contact
          </a>
        </div>

        <div className='flex items-center gap-4'>
          <a href='#' className='text-white/50 hover:text-white transition-colors'>
            <FacebookIcon className='size-5' />
          </a>
          <a href='#' className='text-white/50 hover:text-white transition-colors'>
            <InstagramIcon className='size-5' />
          </a>
          <a href='#' className='text-white/50 hover:text-white transition-colors'>
            <TwitterIcon className='size-5' />
          </a>
          <a href='#' className='text-white/50 hover:text-white transition-colors'>
            <YoutubeIcon className='size-5' />
          </a>
        </div>
      </div>

      <Separator className='bg-white/10' />

      <div className='mx-auto flex max-w-7xl justify-center px-4 py-6 sm:px-6'>
        <p className='text-center text-sm text-white/40'>
          {`© ${new Date().getFullYear()}`}{' '}
          <a href='#' className='text-white/60 hover:text-white hover:underline transition-colors'>
            Kora
          </a>
          {' · The Programmable Credit Network'}
        </p>
      </div>
    </footer>
  )
}

export default Footer
