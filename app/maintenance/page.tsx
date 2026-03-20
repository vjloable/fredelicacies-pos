export default function MaintenancePage() {
  return (
    <div className='min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center px-6'>
      <div className='max-w-md w-full flex flex-col items-center text-center gap-8'>

        {/* Illustration */}
        <svg
          viewBox='0 0 240 200'
          className='w-64 h-52'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
          aria-hidden='true'
        >
          {/* Shop front */}
          <rect x='40' y='90' width='160' height='90' rx='4' fill='#FFDEC9' />
          <rect x='40' y='72' width='160' height='24' rx='4' fill='#DA834D' />

          {/* Awning stripes */}
          {[0,1,2,3,4,5,6].map(i => (
            <rect key={i} x={40 + i * 23} y='72' width='12' height='24' fill='#C06B38' opacity='0.4' />
          ))}

          {/* Door */}
          <rect x='98' y='130' width='44' height='50' rx='3' fill='#4C2E24' opacity='0.15' />
          <rect x='98' y='130' width='44' height='50' rx='3' stroke='#4C2E24' strokeWidth='2' fill='none' />
          <circle cx='136' cy='156' r='3' fill='#4C2E24' opacity='0.5' />

          {/* Window left */}
          <rect x='52' y='104' width='34' height='28' rx='3' fill='white' opacity='0.7' />
          <line x1='69' y1='104' x2='69' y2='132' stroke='#DA834D' strokeWidth='1.5' />
          <line x1='52' y1='118' x2='86' y2='118' stroke='#DA834D' strokeWidth='1.5' />

          {/* Window right */}
          <rect x='154' y='104' width='34' height='28' rx='3' fill='white' opacity='0.7' />
          <line x1='171' y1='104' x2='171' y2='132' stroke='#DA834D' strokeWidth='1.5' />
          <line x1='154' y1='118' x2='188' y2='118' stroke='#DA834D' strokeWidth='1.5' />

          {/* Ground */}
          <rect x='30' y='178' width='180' height='6' rx='3' fill='#FFDEC9' />

          {/* Wrench */}
          <g transform='translate(148, 50) rotate(-35)'>
            <rect x='-5' y='-22' width='10' height='40' rx='5' fill='#DA834D' />
            <circle cx='0' cy='-22' r='10' fill='#DA834D' />
            <circle cx='0' cy='-22' r='5' fill='#FFF9F5' />
            <circle cx='0' cy='18' r='10' fill='#DA834D' />
            <circle cx='0' cy='18' r='5' fill='#FFF9F5' />
          </g>

          {/* Gear */}
          <g transform='translate(88, 44)'>
            <circle cx='0' cy='0' r='16' fill='#4C2E24' opacity='0.15' />
            <circle cx='0' cy='0' r='10' fill='#4C2E24' opacity='0.2' />
            <circle cx='0' cy='0' r='5' fill='#FFF9F5' />
            {[0,45,90,135,180,225,270,315].map((angle, i) => (
              <rect
                key={i}
                x='-3'
                y='-20'
                width='6'
                height='8'
                rx='1'
                fill='#4C2E24'
                opacity='0.25'
                transform={`rotate(${angle})`}
              />
            ))}
          </g>

          {/* Barrier cone left */}
          <polygon points='22,178 30,140 38,178' fill='#DA834D' />
          <rect x='20' y='154' width='20' height='4' rx='1' fill='white' opacity='0.6' />

          {/* Barrier cone right */}
          <polygon points='202,178 210,140 218,178' fill='#DA834D' />
          <rect x='200' y='154' width='20' height='4' rx='1' fill='white' opacity='0.6' />

          {/* Dashed barrier line */}
          <line x1='38' y1='160' x2='202' y2='160' stroke='#DA834D' strokeWidth='2' strokeDasharray='8 6' />
        </svg>

        {/* Text */}
        <div className='space-y-3'>
          <h1 className='text-3xl font-black text-[#4C2E24]'>
            We&apos;ll be back soon
          </h1>
          <p className='text-[#4C2E24] opacity-60 text-sm leading-relaxed'>
            Fredelecacies POS is currently undergoing scheduled maintenance.
            <br />
            We&apos;re working hard to improve your experience.
          </p>
        </div>

        {/* Status badge */}
        <div className='flex items-center gap-2 bg-[#DA834D]/10 border border-[#DA834D]/30 rounded-full px-4 py-2'>
          <span className='w-2 h-2 rounded-full bg-[#DA834D] animate-pulse' />
          <span className='text-xs font-semibold text-[#DA834D]'>Maintenance in progress</span>
        </div>

        {/* Footer */}
        <p className='text-xs text-[#4C2E24] opacity-30'>
          Fredelecacies &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
