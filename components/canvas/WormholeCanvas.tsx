'use client'

import { useEffect, useRef } from 'react'

class Particle {
  x: number; y: number; size: number
  speedX: number; speedY: number
  angle: number; spin: number
  alpha: number; initialAlpha: number
  color: string; canvasWidth: number; canvasHeight: number

  constructor(x: number, y: number, w: number, h: number) {
    this.canvasWidth = w; this.canvasHeight = h
    this.x = x; this.y = y
    this.size = Math.random() * 1.5 + 0.3
    this.speedX = (Math.random() - 0.5) * 0.4
    this.speedY = Math.random() * 0.45 + 0.15
    this.angle = Math.random() * Math.PI * 2
    this.spin = (Math.random() - 0.5) * 0.01
    this.initialAlpha = 0.25 + Math.random() * 0.4
    this.alpha = this.initialAlpha
    this.color = `hsl(${Math.random() * 60 + 180}, 70%, 70%)`
  }

  update() {
    this.x += this.speedX
    this.y -= this.speedY
    this.angle += this.spin
    this.alpha -= 0.0018
    if (this.y < -this.size || this.alpha <= 0) {
      this.y = this.canvasHeight + this.size
      this.x = Math.random() * this.canvasWidth
      this.alpha = this.initialAlpha
      this.size = Math.random() * 1.5 + 0.3
    }
    if (this.x < -this.size) this.x = this.canvasWidth + this.size
    else if (this.x > this.canvasWidth + this.size) this.x = -this.size
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return
    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

export default function WormholeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let particles: Particle[] = []
    let animId: number

    const setup = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      particles = Array.from({ length: 70 }, () =>
        new Particle(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          canvas.width, canvas.height
        )
      )
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(9,10,15,0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => { p.update(); p.draw(ctx) })
      animId = requestAnimationFrame(animate)
    }

    let resizeTimer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        cancelAnimationFrame(animId)
        setup()
        animate()
      }, 150)
    }

    setup()
    animate()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  )
}
