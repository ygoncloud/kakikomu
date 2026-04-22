import { type NextRequest } from 'next/server'
import { ImageResponse } from 'next/og'

import * as libConfig from '@/lib/config'
import { type NotionPageInfo } from '@/lib/types'

export const runtime = 'edge'

export default async function OGImage(req: NextRequest) {
  const { searchParams } = new URL(req.url!)
  const pageId = searchParams.get('id') || libConfig.rootNotionPageId

  const interSemiBoldFont = await fetch(
    new URL('../../public/fonts/inter-semibold.ttf', import.meta.url)
  ).then((res) => res.arrayBuffer())

  if (!pageId) {
    return new Response('Invalid notion page id', { status: 400 })
  }

  const apiHost = libConfig.apiHost
  const pageInfoRes = await fetch(
    `${apiHost}/api/notion-page-info?pageId=${encodeURIComponent(pageId)}`
  )

  if (!pageInfoRes.ok) {
    const error = await pageInfoRes.text()
    return new Response(error, { status: pageInfoRes.status })
  }

  const pageInfo: NotionPageInfo = (await pageInfoRes.json()) as NotionPageInfo

  return new ImageResponse(
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1F2027',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'black'
      }}
    >
      {pageInfo.image && (
        <img
          src={pageInfo.image}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      )}

      <div
        style={{
          position: 'relative',
          width: 900,
          height: 465,
          display: 'flex',
          flexDirection: 'column',
          border: '16px solid rgba(0,0,0,0.3)',
          borderRadius: 8,
          zIndex: '1'
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            backgroundColor: '#fff',
            padding: 24,
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          {pageInfo.detail && (
            <div style={{ fontSize: 32, opacity: 0 }}>{pageInfo.detail}</div>
          )}

          <div
            style={{
              fontSize: 70,
              fontWeight: 700,
              fontFamily: 'Inter'
            }}
          >
            {pageInfo.title}
          </div>

          {pageInfo.detail && (
            <div style={{ fontSize: 32, opacity: 0.6 }}>{pageInfo.detail}</div>
          )}
        </div>
      </div>

      {pageInfo.authorImage && (
        <div
          style={{
            position: 'absolute',
            top: 47,
            left: 104,
            height: 128,
            width: 128,
            display: 'flex',
            borderRadius: '50%',
            border: '4px solid #fff',
            zIndex: '5'
          }}
        >
          <img
            src={pageInfo.authorImage}
            style={{
              width: '100%',
              height: '100%'
            }}
          />
        </div>
      )}
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: interSemiBoldFont,
          style: 'normal',
          weight: 700
        }
      ]
    }
  )
}
