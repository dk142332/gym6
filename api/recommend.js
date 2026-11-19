module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Vercel 환경변수에 GEMINI_API_KEY가 설정되지 않았습니다. 설정 후 Redeploy 해주세요.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { images, goal, duration } = body;

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: '운동기구 사진을 최소 1장 이상 추가해주세요.' });
    }

    const prompt = `
당신은 친절하고 전문적인 퍼스널 트레이너입니다.
첨부된 사진들은 헬스장 초보자(헬린이)가 현재 이용할 수 있는 운동기구들입니다.

[사용자 조건]
- 운동 목표: ${goal || '전신 근력 및 기초 체력 향상'}
- 희망 운동 시간: ${duration || '45분'}

[요청 사항]
1. **인식된 운동기구 목록**: 사진에서 확인되는 기구들의 정확한 명칭과 주요 타겟 부위를 나열해주세요. (운동기구가 아닌 사진은 제외)
2. **맞춤형 헬린이 운동 루틴**: 위에서 인식된 기구들(필요시 맨몸운동 포함)만을 활용해 운동 순서대로 루틴을 짜주세요.
   - 각 운동마다 **추천 세트 수, 반복 횟수, 세트 간 휴식 시간**을 명시하세요.
3. **초보자 핵심 팁**: 기구 사용 시 부상을 방지하기 위한 자세 포인트와 첫 중량 설정 방법을 간단명료하게 알려주세요.

가독성이 좋도록 마크다운(Markdown) 형식으로 깔끔하게 작성해주세요.
`;

    const parts = [
      { text: prompt },
      ...images.map((base64Data) => ({
        inline_data: {
          mime_type: 'image/jpeg',
          data: base64Data.includes(',') ? base64Data.split(',')[1] : base64Data,
        },
      })),
    ];

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim(),
        },
        body: JSON.stringify({
          contents: [{ parts }],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Gemini API 오류 (상태 코드: ${response.status})`);
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      throw new Error('AI가 유효한 응답을 생성하지 못했습니다. 다른 사진으로 다시 시도해주세요.');
    }

    return res.status(200).json({ result: resultText });
  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: error.message || '서버 내부 오류가 발생했습니다.' });
  }
};