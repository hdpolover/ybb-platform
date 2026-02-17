package telemetry

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type LokiCore struct {
	zapcore.LevelEnabler
	encoder zapcore.Encoder
	url     string
	labels  map[string]string
	client  *http.Client
}

func NewLokiCore(url string, labels map[string]string, level zapcore.LevelEnabler) zapcore.Core {
	return &LokiCore{
		LevelEnabler: level,
		encoder:      zapcore.NewJSONEncoder(zap.NewProductionEncoderConfig()),
		url:          fmt.Sprintf("%s/loki/api/v1/push", url),
		labels:       labels,
		client:       &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *LokiCore) With(fields []zapcore.Field) zapcore.Core {
	clone := *c
	clone.encoder = c.encoder.Clone()
	for _, f := range fields {
		f.AddTo(clone.encoder)
	}
	return &clone
}

func (c *LokiCore) Check(entry zapcore.Entry, ce *zapcore.CheckedEntry) *zapcore.CheckedEntry {
	if c.Enabled(entry.Level) {
		return ce.AddCore(entry, c)
	}
	return ce
}

func (c *LokiCore) Write(entry zapcore.Entry, fields []zapcore.Field) error {
	buf, err := c.encoder.EncodeEntry(entry, fields)
	if err != nil {
		return err
	}
	defer buf.Free()

	// Simple non-batched push for reliability in this task
	// In production, you'd use a channel and batching.
	go c.pushToLoki(entry.Time, buf.String())

	return nil
}

func (c *LokiCore) Sync() error {
	return nil
}

type lokiPushRequest struct {
	Streams []lokiStream `json:"streams"`
}

type lokiStream struct {
	Stream map[string]string `json:"stream"`
	Values [][]string        `json:"values"`
}

func (c *LokiCore) pushToLoki(t time.Time, line string) {
	req := lokiPushRequest{
		Streams: []lokiStream{
			{
				Stream: c.labels,
				Values: [][]string{
					{fmt.Sprintf("%d", t.UnixNano()), line},
				},
			},
		},
	}

	body, _ := json.Marshal(req)
	resp, err := c.client.Post(c.url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return
	}
	defer resp.Body.Close()
}
